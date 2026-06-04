/**
 * Stripe billing routes.
 * Requires env vars:
 *   STRIPE_SECRET_KEY       - Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_PUBLISHABLE_KEY  - For frontend (returned via /billing/config)
 *   STRIPE_WEBHOOK_SECRET   - whsec_... from Stripe dashboard
 *   STRIPE_PRICE_PRO        - price_... monthly Pro plan
 *   STRIPE_PRICE_PRO_PLUS   - price_... monthly Pro+ plan
 *   APP_PUBLIC_URL          - e.g. https://wenap.app
 *
 * Without STRIPE_SECRET_KEY, all endpoints return 503 with { error: 'STRIPE_NOT_CONFIGURED' }
 * so the frontend can fall back to a "contact us" CTA.
 */

const express = require('express');
const { requireAuth } = require('../middleware/requireAuth.cjs');
const { getUserById, publicUser } = require('../db/auth.cjs');
const { getDb } = require('./billingDb.cjs');

const router = express.Router();

const APP_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
const STRIPE_SECRET = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const STRIPE_PRICE = {
  pro: (process.env.STRIPE_PRICE_PRO || '').trim(),
  pro_plus: (process.env.STRIPE_PRICE_PRO_PLUS || '').trim(),
};

let stripeClient;

function getStripe() {
  if (!STRIPE_SECRET) return null;
  if (stripeClient !== undefined) return stripeClient;
  try {
    stripeClient = require('stripe')(STRIPE_SECRET);
    return stripeClient;
  } catch (e) {
    console.error('[Wenap] Stripe SDK load failed:', e.message);
    stripeClient = null;
    return null;
  }
}

function isStripeReady() {
  return Boolean(
    getStripe() &&
      STRIPE_PRICE.pro &&
      STRIPE_PRICE.pro_plus &&
      (process.env.STRIPE_PUBLISHABLE_KEY || '').trim(),
  );
}

function noStripe(res) {
  return res.status(503).json({
    error: 'STRIPE_NOT_CONFIGURED',
    message: 'Stripe is not configured. To upgrade, email support@wenap.app.',
    contactEmail: 'support@wenap.app',
  });
}

function tierFromPriceId(priceId) {
  const id = String(priceId || '').trim();
  if (id && id === STRIPE_PRICE.pro_plus) return 'pro_plus';
  if (id && id === STRIPE_PRICE.pro) return 'pro';
  return 'pro';
}

function applyPaidSubscription({ userId, tier, customerId, subscriptionId, customerCountry }) {
  const normalizedTier = tier === 'pro_plus' ? 'pro_plus' : 'pro';
  const { initDb } = require('../db/store.cjs');
  const adb = initDb();
  adb.prepare(`UPDATE users SET tier = ?, referral_bonus_until = NULL WHERE id = ?`).run(
    normalizedTier,
    userId,
  );

  const db = getDb();
  db.prepare(`
    INSERT INTO billing (user_id, stripe_customer_id, stripe_subscription_id, tier, status, customer_country, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      tier = excluded.tier,
      status = 'active',
      customer_country = COALESCE(excluded.customer_country, billing.customer_country),
      updated_at = datetime('now')
  `).run(userId, customerId, subscriptionId, normalizedTier, customerCountry || null);
  return normalizedTier;
}

// Public: return Stripe publishable key so frontend can init Stripe.js
router.get('/config', (req, res) => {
  res.json({
    publishableKey: (process.env.STRIPE_PUBLISHABLE_KEY || '').trim() || null,
    prices: {
      pro: STRIPE_PRICE.pro || null,
      pro_plus: STRIPE_PRICE.pro_plus || null,
    },
    configured: isStripeReady(),
  });
});

// Create a Checkout Session for the requested tier
const MSG = require('../lib/apiMessages.cjs');
const { legalStatusForUser, recordConsents, clientMeta: legalClientMeta } = require('../lib/legalConsent.cjs');

router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return noStripe(res);

  if (!req.body?.agreeSubscriptionTerms) {
    return res.status(400).json({
      error: 'SUBSCRIPTION_CONSENT_REQUIRED',
      message: MSG.SUBSCRIPTION_CONSENT_REQUIRED,
    });
  }

  const user = getUserById(req.authUser.id);
  const legal = legalStatusForUser(user);
  if (legal.needsReaccept) {
    return res.status(403).json({
      error: 'LEGAL_REACCEPT_REQUIRED',
      message: MSG.LEGAL_REACCEPT_REQUIRED,
      missing: legal.missing,
    });
  }

  const tier = String(req.body?.tier || '').toLowerCase();
  const priceId = STRIPE_PRICE[tier === 'pro_plus' ? 'pro_plus' : 'pro'];
  if (!priceId) {
    return res.status(400).json({ error: 'INVALID_TIER', message: 'Tier must be pro or pro_plus.' });
  }

  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  recordConsents(user.id, ['subscription'], legalClientMeta(req));

  try {
    const db = getDb();
    const billingRow = db
      .prepare('SELECT stripe_customer_id, stripe_subscription_id, tier, status FROM billing WHERE user_id = ?')
      .get(user.id);
    const existingCustomerId = billingRow?.stripe_customer_id;
    const activeSub = Boolean(
      existingCustomerId &&
      billingRow?.stripe_subscription_id &&
      String(billingRow?.status || '').toLowerCase() === 'active',
    );

    // Safety guard: do not create a second subscription for an already-active customer.
    // Force plan changes through Stripe Customer Portal to avoid potential double charges.
    if (activeSub) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: existingCustomerId,
        return_url: `${APP_URL}/settings`,
      });
      return res.status(409).json({
        error: 'ACTIVE_SUBSCRIPTION_USE_PORTAL',
        message: 'Active subscription detected. Use customer portal to change plan safely.',
        currentTier: billingRow?.tier || null,
        url: portal.url,
      });
    }

    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/app?checkout=success&tier=${tier}`,
      cancel_url: `${APP_URL}/pricing?checkout=cancelled`,
      metadata: { userId: user.id, tier },
      subscription_data: { metadata: { userId: user.id, tier } },
    };

    if (existingCustomerId) {
      sessionParams.customer = existingCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('[Wenap] Stripe checkout error:', e.message);
    res.status(500).json({ error: 'STRIPE_ERROR', message: e.message });
  }
});

// After Checkout redirect: sync tier from Stripe if webhook was delayed or missed
router.post('/sync-after-checkout', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return noStripe(res);

  const user = getUserById(req.authUser.id);
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const db = getDb();
    const billingRow = db
      .prepare('SELECT stripe_customer_id FROM billing WHERE user_id = ?')
      .get(user.id);

    let customerId = billingRow?.stripe_customer_id || null;
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 3 });
      customerId = customers.data[0]?.id || null;
    }
    if (!customerId) {
      return res.status(404).json({
        error: 'NO_CUSTOMER',
        message: 'No Stripe customer found for this account yet.',
      });
    }

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 5,
    });
    const sub = subs.data[0];
    if (!sub) {
      return res.status(404).json({
        error: 'NO_SUBSCRIPTION',
        message: 'No active Stripe subscription found.',
      });
    }

    const priceId = sub.items?.data?.[0]?.price?.id;
    const tier =
      sub.metadata?.tier ||
      tierFromPriceId(priceId);

    applyPaidSubscription({
      userId: user.id,
      tier,
      customerId,
      subscriptionId: sub.id,
      customerCountry: null,
    });

    const updated = getUserById(user.id);
    console.log(`[Wenap] Stripe sync-after-checkout: user ${user.id} -> ${tier}`);
    res.json({ ok: true, tier, user: publicUser(updated) });
  } catch (e) {
    console.error('[Wenap] Stripe sync-after-checkout error:', e.message);
    res.status(500).json({ error: 'STRIPE_ERROR', message: e.message });
  }
});

// Stripe Customer Portal (manage subscription / cancel / change card)
router.post('/portal-session', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return noStripe(res);

  try {
    const db = getDb();
    const row = db
      .prepare('SELECT stripe_customer_id FROM billing WHERE user_id = ?')
      .get(req.authUser.id);

    if (!row?.stripe_customer_id) {
      return res.status(400).json({ error: 'NO_SUBSCRIPTION', message: 'No active Stripe subscription found.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${APP_URL}/settings`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('[Wenap] Stripe portal error:', e.message);
    res.status(500).json({ error: 'STRIPE_ERROR', message: e.message });
  }
});

// Stripe Webhook handler (raw body parsed in server.cjs before express.json)
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.sendStatus(200);

  let event;
  try {
    event = STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)
      : JSON.parse(req.body.toString());
  } catch (e) {
    console.error('[Wenap] Stripe webhook signature verification failed:', e.message);
    return res.status(400).json({ error: 'WEBHOOK_SIGNATURE_INVALID' });
  }

  const db = getDb();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier || 'pro';
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const customerCountry =
        session.customer_details?.address?.country ||
        session.shipping_details?.address?.country ||
        null;

      if (userId) {
        applyPaidSubscription({
          userId,
          tier,
          customerId,
          subscriptionId,
          customerCountry,
        });
        console.log(`[Wenap] Stripe: user ${userId} upgraded to ${tier}`);
      } else {
        console.warn('[Wenap] Stripe checkout.session.completed missing metadata.userId');
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const customerId = sub.customer;
      const status = sub.status;
      const renewsAt = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      const billingRow = db.prepare('SELECT user_id, tier FROM billing WHERE stripe_customer_id = ?').get(customerId);
      if (billingRow) {
        db.prepare(`
          UPDATE billing SET status = ?, subscription_renews_at = ?, updated_at = datetime('now')
          WHERE stripe_customer_id = ?
        `).run(status, renewsAt, customerId);

        if (status === 'active') {
          const { initDb } = require('../db/store.cjs');
          const adb = initDb();
          adb.prepare(`UPDATE users SET tier = ?, referral_bonus_until = NULL WHERE id = ?`).run(billingRow.tier, billingRow.user_id);
        }
        console.log(`[Wenap] Stripe: subscription ${status} for customer ${customerId}`);
      }
    } else if (event.type === 'invoice.paid') {
      const inv = event.data.object;
      const amountUsd = (Number(inv.amount_paid) || 0) / 100;
      const customerId = inv.customer;
      const paidAt = inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
        : new Date().toISOString();
      const billingRow = customerId
        ? db.prepare('SELECT user_id, tier FROM billing WHERE stripe_customer_id = ?').get(customerId)
        : null;
      const { recordBillingEvent } = require('../db/store.cjs');
      recordBillingEvent({
        userId: billingRow?.user_id || null,
        stripeInvoiceId: inv.id,
        amountUsd,
        tier: billingRow?.tier || null,
        paidAt,
        eventType: 'invoice.paid',
      });
      console.log(`[Wenap] Stripe: invoice.paid $${amountUsd} customer=${customerId}`);
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customerId = sub.customer;
      const billingRow = db.prepare('SELECT user_id FROM billing WHERE stripe_customer_id = ?').get(customerId);

      if (billingRow) {
        db.prepare(`UPDATE billing SET status = 'cancelled', updated_at = datetime('now') WHERE stripe_customer_id = ?`).run(customerId);
        const { initDb } = require('../db/store.cjs');
        const adb = initDb();
        adb.prepare(`UPDATE users SET tier = 'free', referral_bonus_until = NULL WHERE id = ?`).run(billingRow.user_id);
        console.log(`[Wenap] Stripe: subscription cancelled for customer ${customerId}, user downgraded to free`);
      }
    }
  } catch (e) {
    console.error('[Wenap] Stripe webhook processing error:', e.message);
  }

  res.sendStatus(200);
});

module.exports = router;
