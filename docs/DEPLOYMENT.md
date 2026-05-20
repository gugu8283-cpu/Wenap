# Wenap deployment notes

Production setup is documented in the repository **[README.md](../README.md)** (Stripe, Resend, cron, environment variables, and `npm run build` + `NODE_ENV=production`).

Additional platform guides (if present in this repo):

- `docs/DEPLOY-VULTR.md` — VPS / Docker-style hosting
- `docs/DEPLOY-RENDER.md` — Render.com

## Weekly auto-analysis

To run the Monday 02:00 UTC job that refreshes featured tickers for `/sample/:ticker`:

1. Create or pick a **real user** in `users` (e.g. a dedicated service account). That user’s tier controls which model runs (use Pro+ if you want Haiku on the cron account).
2. Set in `.env`:
   - `WENAP_CRON_SECRET` — at least 8 characters; must match the value the server sends on `X-Wenap-Cron-Secret`.
   - `CRON_SERVICE_USER_ID` — that user’s `id` (UUID).
3. Leave `CRON_AUTO_ANALYSIS` unset (default on) or set to `true`.

Without these two variables, the weekly job is **disabled** so accidental unauthenticated analyze calls do not run.

## Referral Pro bonus

Referrals are stored when someone registers with `?ref=<referrer user id>`. After the **referee verifies email**, both referrer and referee can receive **about one month of Pro** in the database (`tier = pro`, `referral_bonus_until`), unless they already have **Pro+** or an **active Stripe subscription**. This does **not** charge your card per user; **OpenRouter cost only happens when someone runs an analysis**. Set `WENAP_REFERRAL_REWARDS=0` to disable granting while keeping registration links. When the bonus date passes, referral-granted Pro downgrades to **free** on next authenticated request (Stripe-managed tiers clear `referral_bonus_until` on webhook upgrade).
