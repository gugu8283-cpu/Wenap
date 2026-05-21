# Wenap — AI Investment Research Platform

AI-powered investment research with six-dimension scoring, scenario analysis, supply chain risk, verifiable prediction accuracy, and tiered subscriptions (Free / Pro / Pro+).

---

## Quick Start (Development)

```bash
cp .env.example .env        # fill OPENROUTER_API_KEY (required)
npm ci
npm run dev:full             # Vite :5173 proxies /api → server :3002
```

Open http://localhost:5173

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | LLM API key (OpenRouter) |
| `ALPHA_VANTAGE_API_KEY` | Recommended | Real-time price & fundamentals |
| `JWT_SECRET` | ✅ Production | JWT signing secret (min 32 chars) |
| `ADMIN_SECRET` | ✅ Production | Admin panel access key |
| **Stripe** | | |
| `STRIPE_SECRET_KEY` | For payments | Stripe secret key (sk_...) |
| `STRIPE_PUBLISHABLE_KEY` | For payments | Stripe publishable key (pk_...) |
| `STRIPE_WEBHOOK_SECRET` | For payments | Stripe webhook signing secret |
| `STRIPE_PRICE_PRO` | For payments | Stripe Price ID for Pro monthly |
| `STRIPE_PRICE_PRO_PLUS` | For payments | Stripe Price ID for Pro+ monthly |
| **Email** | | |
| `RESEND_API_KEY` | For emails | Resend API key (re_...) |
| `MAIL_FROM` | For emails | Sender email (e.g. noreply@wenap.app) |
| `SMTP_HOST` | Alt to Resend | SMTP host for fallback |
| `SMTP_PORT` | Alt to Resend | SMTP port (default: 587) |
| `SMTP_USER` | Alt to Resend | SMTP username |
| `SMTP_PASS` | Alt to Resend | SMTP password |
| **AI Models** | | |
| `OPENROUTER_MAIN_MODEL` | Optional | Free tier model (default: google/gemini-2.5-flash-lite) |
| `OPENROUTER_PRO_MODEL` | Optional | Pro tier model (default: google/gemini-2.5-flash-lite) |
| `OPENROUTER_PRO_PLUS_MODEL` | Optional | Pro+ tier model (default: anthropic/claude-haiku-4-5) |
| **App** | | |
| `APP_PUBLIC_URL` | Production | Public URL (e.g. https://wenap.app) |
| `PORT` | Optional | Server port (default: 3002) |
| `CRON_ENABLED` | Optional | Set `false` to disable all cron jobs |
| `CRON_AUTO_ANALYSIS` | Optional | Set `false` to disable weekly auto-analysis |
| `WENAP_FREE_UNLIMITED` | Dev only | Set `1` to disable free quota enforcement |
| `WENAP_PRO_PLUS_DAILY_CAP` | Optional | Pro+ max analyses per **UTC calendar day** (default **80**; blocks runaway abuse, normal users rarely hit it) |
| `WENAP_REFERRAL_REWARDS` | Optional | Set `0` / `false` / `off` to disable referral Pro bonus (no per-user fee; only affects DB tier) |

---

## Production Deployment

### Single-process (recommended)

```bash
npm ci
npm run build
NODE_ENV=production PORT=3002 node server.cjs
```

Windows PowerShell:
```powershell
$env:NODE_ENV="production"; $env:PORT=3002; node server.cjs
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3002
EXPOSE 3002
CMD ["node", "server.cjs"]
```

```bash
docker build -t wenap .
docker run -p 3002:3002 --env-file .env wenap
```

---

## Stripe Setup

1. Create a Stripe account and get your keys from the [Dashboard](https://dashboard.stripe.com/apikeys)
2. Create two recurring Price IDs (monthly):
   - Pro: $9.99/month → set as `STRIPE_PRICE_PRO`
   - Pro+: $19.99/month → set as `STRIPE_PRICE_PRO_PLUS`
3. Set up webhook: Dashboard → Webhooks → Add endpoint → `https://your-domain.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

Without Stripe keys, upgrade buttons show a "Contact us" email fallback.

---

## Email Setup (Resend)

1. Sign up at [resend.com](https://resend.com) and verify your sending domain
2. Create an API key and set `RESEND_API_KEY`
3. Set `MAIL_FROM` to your verified sender address

Without Resend/SMTP, emails are logged to console (dev-friendly fallback).

---

## Cron Jobs

Two cron jobs run automatically (unless disabled):

| Job | Schedule | Description |
|---|---|---|
| Prediction verification | Daily 00:00 UTC | Verify due predictions against actual prices |
| Weekly auto-analysis | Mondays 02:00 UTC | Run AI analysis on 10 featured tickers (NVDA, AAPL, JPM, ...) |

To disable all cron: `CRON_ENABLED=false`  
To disable only weekly auto-analysis: `CRON_AUTO_ANALYSIS=false`

**Weekly job authentication:** the server calls `POST /analyze` on itself using header `X-Wenap-Cron-Secret` (must match `WENAP_CRON_SECRET`, ≥8 characters) and impersonates user `CRON_SERVICE_USER_ID` (a real `users.id` in your database, e.g. a dedicated service account). If either variable is missing, the weekly job does not schedule (safe default).

The weekly auto-analysis feeds the `/sample/:ticker` public reports and prediction data. See also `docs/DEPLOYMENT.md`.

---

## AI Model Tiers

| Tier | Model | Sources | Monthly cap |
|---|---|---|---|
| Free | Gemini 2.5 Flash Lite | 5 | 5 |
| Pro | Gemini 2.5 Flash Lite | 8 | Unlimited |
| Pro+ | Claude Haiku 4.5 | 8 | **80/day** cap (UTC) |

Override models via environment variables. Pro+ daily cap: `WENAP_PRO_PLUS_DAILY_CAP` (default **80**, UTC day). Raise to `200`+ only if you accept higher API cost.

---

## Key Routes

| Route | Description |
|---|---|
| `GET /` | Landing page (unauthenticated) |
| `GET /app` | Main app (requires auth) |
| `GET /pricing` | Pricing page |
| `GET /sample/:ticker` | Public sample report (featured tickers only) |
| `GET /compare` | Side-by-side compare (Pro+ only) |
| `GET /accuracy` | Public prediction accuracy stats |
| `GET /about` | How Wenap works |
| `GET /health` | Server health check (JSON) |
| `GET /api/og/:ticker` | OG image (SVG) for social sharing |
| `POST /api/analyze` | Run AI analysis (auth required) |
| `POST /api/billing/create-checkout-session` | Start Stripe checkout |
| `GET /admin` | Admin panel |

---

## Native Module Rebuild

If you see `NODE_MODULE_VERSION` errors with `better-sqlite3`:

```bash
npm run rebuild:native
# or
npm rebuild better-sqlite3
```

---

## Architecture

```
stockai/
├── server.cjs          # Express backend (main entry)
├── routes/
│   ├── auth.cjs        # Register, login, verify, reset password, referral
│   ├── billing.cjs     # Stripe checkout, webhook, portal
│   ├── notifications.cjs # In-app notifications
│   ├── admin.cjs       # Admin stats, conversion funnel
│   └── publicAccuracy.cjs
├── db/
│   ├── store.cjs       # SQLite DB (predictions, analysis logs)
│   └── auth.cjs        # User auth, quota enforcement
├── lib/
│   ├── emailSend.cjs   # Resend/SMTP email (welcome, quota, weekly digest, etc.)
│   └── outputLocale.cjs # i18n for server-side prompts
├── jobs/
│   ├── verifyPredictions.cjs  # Daily cron: verify due predictions
│   └── weeklyAutoAnalysis.cjs # Monday cron: auto-run 10 featured tickers
├── src/               # React frontend (Vite)
│   ├── pages/         # LandingPage, PricingPage, SettingsPage, ComparePage, SampleReportPage, AboutPage
│   ├── components/    # NotificationCenter, QuotaStrip, analysis/...
│   └── i18n/locales/  # en, zh-CN, zh-TW, ja, ko, de
└── public/
    └── sw.js          # PWA service worker
```
