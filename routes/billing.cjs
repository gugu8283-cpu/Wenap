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
const { getUserById } = require('../db/auth.cjs');
const { getDb } = require('./billingDb.cjs');

const router = express.Router();

const APP_URL = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
const STRIPE_SECRET = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const STRIPE_PRICE = {
  pro: (process.env.STRIPE_PRICE_PRO || '').trim(),
  pro_plus: (process.env.STRIPE_PRICE_PRO_PLUS || '').trim(),
};

function getStripe() {
  if (!STRIPE_SECRET) return null;
  try {
    return require('stripe')(STRIPE_SECRET);
  } catch {
    return null;
  }
}

function noStripe(res) {
  return res.status(503).json({
    error: 'STRIPE_NOT_CONFIGURED',
    message: 'Stripe is not configured. To upgrade, email support@wenap.app.',
    contactEmail: 'support@wenap.app',
  });
}

// Public: return Stripe publishable key so frontend can init Stripe.js
router.get('/config', (req, res) => {
  res.json({
    publishableKey: (process.env.STRIPE_PUBLISHABLE_KEY || '').trim() || null,
    prices: {
      pro: STRIPE_PRICE.pro || null,
      pro_plus: STRIPE_PRICE.pro_plus || null,
    },
    configured: Boolean(STRIPE_SECRET),
  });
});

// Create a Checkout Session for the requested tier
const { legalStatusForUser, recordConsents, clientMeta: legalClientMeta } = require('../lib/legalConsent.cjs');

router.post('/create-checkout-session', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return noStripe(res);

  if (!req.body?.agreeSubscriptionTerms) {
    return res.status(400).json({
      error: 'SUBSCRIPTION_CONSENT_REQUIRED',
      message: '请确认同意服务条款中的付费与订阅条款后再继续',
    });
  }

  const user = getUserById(req.authUser.id);
  const legal = legalStatusForUser(user);
  if (legal.needsReaccept) {
    return res.status(403).json({
      error: 'LEGAL_REACCEPT_REQUIRED',
      message: '请先更新并同意最新版法律文件',
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
    const existingCustomerId = db
      .prepare('SELECT stripe_customer_id FROM billing WHERE user_id = ?')
      .get(user.id)?.stripe_customer_id;

    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/?checkout=success&tier=${tier}`,
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

// Stripe Webhook handler (raw body required - set up in server.cjs before json middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
        const { initDb } = require('../db/store.cjs');
        const adb = initDb();
        adb.prepare(`UPDATE users SET tier = ?, referral_bonus_until = NULL WHERE id = ?`).run(tier, userId);

        // Upsert billing row
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
        `).run(userId, customerId, subscriptionId, tier, customerCountry);

        console.log(`[Wenap] Stripe: user ${userId} upgraded to ${tier}`);
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
