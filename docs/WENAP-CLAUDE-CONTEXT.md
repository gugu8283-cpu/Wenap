# Wenap — Product & Technical Context (for Claude / AI assistants)

> **Purpose:** Single source of truth for what Wenap does today and how it is implemented.  
> **Production:** https://wenap.app · **Repo:** `gugu8283-cpu/Wenap` · **Host:** Render (Singapore) · **DNS:** Cloudflare → `wenap.onrender.com`  
> **Operator:** Japan-based indie; Stripe Japan (Live); tax self-managed (not Stripe Managed Payments).

---

## 1. What Wenap is

**Wenap** is a B2C SaaS web app that generates **AI investment research reports** for stocks/ETFs:

- User enters a ticker (e.g. NVDA, AAPL).
- Backend calls **OpenRouter** (LLM) + **Alpha Vantage** (prices/fundamentals) + optional web search context.
- Frontend shows a structured report: six-dimension radar score, signal (buy/hold/sell), scenarios, key levels, sources, etc.
- **Not** a broker, **not** registered investment advice — disclaimers + explicit user consent required.

**Monetization:** Stripe subscriptions — **Pro $9.99/mo**, **Pro+ $19.99/mo** (USD). Free tier: 5 analyses/month.

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router 7, Tailwind 4, i18next (zh-CN, zh-TW, en, ja, ko, de) |
| Backend | Node 18+, Express 5, single process `server.cjs` |
| DB | SQLite via `better-sqlite3`, path `SQLITE_PATH` (default `./data/wenap.db`) |
| Auth | JWT in `Authorization: Bearer`, stored client-side `localStorage` key `wenap_token` |
| Payments | Stripe Checkout + Customer Portal + webhooks |
| Email | Resend (primary) or SMTP fallback; domain `wenap.app` |
| Deploy | `npm run build` → `dist/` served by Express when `NODE_ENV=production` |

**Dev:** `npm run dev:full` — Vite :5173 proxies `/api` → Express :3002.

---

## 3. Subscription tiers & feature gating

| Tier | DB value | Price | Model (default) | Analysis quota | Extra UI |
|------|----------|-------|-----------------|----------------|----------|
| Free | `free` | $0 | `google/gemini-2.5-flash-lite` | 5/month | Basic report |
| Pro | `pro` | $9.99/mo | same as free | Unlimited | Action line, key events, insider summary, peer block, more sources |
| Pro+ | `pro_plus` | $19.99/mo | `openai/gpt-5.4-mini` | 80/day UTC cap (`WENAP_PRO_PLUS_DAILY_CAP`) | Bull/Bear debate, Critic, PDF export, `/compare` |

**Enforcement:**

- `db/auth.cjs` → `checkUserCanAnalyze()` — quota, email verified, tier.
- `server.cjs` `POST /api/analyze` — calls auth checks before LLM pipeline.
- Frontend: `ProPlusLockedSection`, `ProUpgradeBar`, `UpgradeDecisionModal`, `QuotaStrip`.

**Stripe env (production):**

- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_PLUS` (not `STRIPE_PRICE`).
- Webhook: `https://wenap.app/api/billing/webhook`.

---

## 4. User-facing routes (frontend)

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/` | `LandingPage` | No | Marketing, sample ticker links |
| `/register` | `RegisterPage` | No | 3 legal checkboxes + server consent log |
| `/login` | `LoginPage` | No | Blocks if email not verified |
| `/verify-email` | `VerifyEmailPage` | No | Token in URL; sets JWT on success |
| `/accept-legal` | `AcceptLegalPage` | Yes | Re-consent when legal version bumps |
| `/forgot-password` | `ForgotPasswordPage` | No | |
| `/pricing` | `PricingPage` | Optional | Subscription consent checkbox before Stripe |
| `/settings` | `SettingsPage` | Yes | Billing portal, referral link, logout |
| `/app` | `AppShell` → `App.jsx` | Yes | Main analysis UI |
| `/sample/:ticker` | `SampleReportPage` | No | Public demos (allowlisted tickers) |
| `/compare` | `ComparePage` | Pro+ | Two-ticker compare |
| `/accuracy` | `AccuracyPage` | No | Public verified prediction stats |
| `/about`, `/methodology` | `AboutPage` | No | How it works |
| `/privacy`, `/terms`, `/disclaimer` | `LegalPage` | No | i18n legal JSON |
| `/admin/*` | `AdminApp` | `ADMIN_SECRET` | Separate token `wenap_admin_auth` |

**Guard chain (`ProtectedRoute`):** logged in → email verified → `user.legal.needsReaccept` false → render app.

---

## 5. Core user flow: analysis

```
User (browser)
  → POST /api/analyze { symbol, horizon, assetType, riskFocus, locale }
  → middleware requireAuth (JWT)
  → db/auth.cjs checkUserCanAnalyze
  → server.cjs analysis pipeline:
       - Alpha Vantage: price, overview
       - OpenRouter: structured JSON report (prompts in server.cjs + lib/promptSearchRules.cjs)
       - lib/parseModelJson.cjs, lib/priceSanity.cjs (reject bogus price targets)
  → jobs/savePrediction.cjs → SQLite predictions + analysis_logs
  → JSON report → MobileAnalysisReport.jsx (and related sections)
```

**Report UI modules** (`src/components/analysis/`): `HeroCard`, `RadarSection`, `CoreConclusionCard`, `ScenarioSection`, `BullBearSection`, `CritiqueSection`, `KeyLevelsSection`, `SourcesAccordion`, `ExportPdfButton` (Pro+, client print/PDF).

---

## 6. Authentication & legal consent

### Auth (`routes/auth.cjs`, `db/auth.cjs`)

- Register: email/password, disposable email blocked (`lib/disposableEmail.cjs`).
- **Email verification required** before login/analysis (`email_verified`).
- Resend: `POST /auth/resend-verify`; emails via `lib/emailSend.cjs` (Resend).
- Password reset: request + token link.
- Referral: `?ref=` on register → `referrals` table → Pro bonus on verify (`applyReferralRewardsOnVerify`).
- Country on register: `CF-IPCountry` header → `users.country_code` (`lib/countryFromRequest.cjs`).

### Legal consent (`lib/legalConsent.cjs`, `lib/legalVersions.cjs`)

- Versions: `2026-05-21-v1` for terms, privacy, disclaimer.
- **Register:** body must include `agreeTerms`, `agreePrivacy`, `agreeDisclaimer` (all true).
- **Paid upgrade:** `agreeSubscriptionTerms` on `POST /billing/create-checkout-session`.
- Storage: user columns + `legal_consent_log` (doc_type, version, ip, user_agent, timestamp).
- Re-accept: `POST /auth/accept-legal` when version changes.

---

## 7. Billing (`routes/billing.cjs`, `routes/billingDb.cjs`)

| Endpoint | Role |
|----------|------|
| `GET /api/billing/config` | Public Stripe publishable key + price IDs + `configured` |
| `POST /api/billing/create-checkout-session` | Auth; creates Stripe Checkout session |
| `POST /api/billing/portal-session` | Auth; Stripe Customer Portal |
| `POST /api/billing/webhook` | Raw body; updates `users.tier` + `billing` table |

**Billing table:** `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `tier`, `status`, `customer_country` (from checkout).

---

## 8. Admin panel (`/admin`)

**Auth:** `ADMIN_SECRET` in Bearer header (`middleware/adminAuth.cjs`). Optional: `ADMIN_PIN`, `ADMIN_IP_ALLOWLIST` (often unset).

**API prefix:** `/api/admin-api/*` (frontend maps `/admin/...` → `/admin-api/...` in `adminApi.js`).

| Page | Path | Backend |
|------|------|---------|
| Overview | `/admin` | `GET /stats/overview`, funnel |
| Predictions | `/admin/predictions` | list, batch verify, skip |
| Users | `/admin/users` | list, tier, ban, reset trials |
| Analysis logs | `/admin/analysis-logs` | costs, models |
| Revenue | `/admin/revenue` | tier counts, estimated MRR |
| **Finance / 账本** | `/admin/finance` | Japan/foreign users, expenses, CSV/PDF export |
| System | `/admin/system` | API health, costs |

---

## 9. Prediction accuracy system

- Every analysis can save a `predictions` row with horizon (1m–2y).
- Cron `jobs/verifyPredictions.cjs` (daily UTC): fetch actual price via Alpha Vantage, mark correct/incorrect (`lib/predictionLogic.cjs`).
- Public: `GET /api/accuracy/stats` → `/accuracy` page.
- Admin: manual verify/skip, accuracy aggregates.

---

## 10. Background jobs (cron in `server.cjs`)

| Job | When | File |
|-----|------|------|
| Verify predictions | Daily 00:00 UTC | `jobs/verifyPredictions.cjs` |
| Weekly auto-analysis | Mon 02:00 UTC | `jobs/weeklyAutoAnalysis.cjs` |

Weekly job needs `WENAP_CRON_SECRET` + `CRON_SERVICE_USER_ID`. Feeds `/sample/NVDA` etc.

Disable: `CRON_ENABLED=false`, `CRON_AUTO_ANALYSIS=false`.

---

## 11. Notifications

- `routes/notifications.cjs` — in-app notification list, read/mark read.
- `NotificationCenter.jsx` in app header.
- Emails (optional): quota reminder, prediction verified, weekly digest (`lib/emailSend.cjs`).

---

## 12. i18n & conversion UX

- App strings: `src/i18n/locales/{en,zh-CN,...}.json`
- Admin strings: `admin-*.json`
- Legal: `legal-zh-CN.json` merged as `legal.*` namespace
- Conversion: `lib/conversionStats.cjs`, `SocialProofBanner`, `AhaMomentCard`, psychology doc `docs/转化率心理学优化.md`

---

## 13. Key environment variables (production checklist)

```env
# Required
OPENROUTER_API_KEY=
JWT_SECRET=                    # min 32 chars
ADMIN_SECRET=                  # min 32 chars
APP_PUBLIC_URL=https://wenap.app

# Recommended
ALPHA_VANTAGE_API_KEY=
RESEND_API_KEY=
MAIL_FROM=Wenap <noreply@wenap.app>

# Stripe (Live on wenap.app)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PRO_PLUS=price_...

# Optional
SQLITE_PATH=./data/wenap.db
CRON_ENABLED=true
WENAP_PRO_PLUS_DAILY_CAP=80
LEGAL_TERMS_VERSION=2026-05-21-v1   # bump → forces /accept-legal
```

---

## 14. Database (SQLite) — main tables

| Table | Purpose |
|-------|---------|
| `users` | account, tier, quotas, email verify, referral, country_code, legal consent timestamps/versions |
| `billing` | Stripe IDs, subscription status, `customer_country` |
| `predictions` | ticker, signal, scores, horizon, verify status |
| `prediction_results` | verified outcomes |
| `analysis_logs` | per-run cost_usd, model, duration, status |
| `legal_consent_log` | audit trail of user agreements |
| `admin_expenses` | manual opex entries for admin finance page |
| `referrals` | referrer/referee, rewarded flag |
| `notifications` | in-app messages |

Migrations: inline `migrateDb()` / `migrateAuthSchema()` on startup — no separate migration runner.

---

## 15. Important code paths (quick file map)

```
server.cjs                 # Express app, POST /api/analyze, static dist, cron
routes/auth.cjs            # Auth + legal accept
routes/billing.cjs         # Stripe
routes/admin.cjs           # Admin API incl. bookkeeping
db/store.cjs               # predictions, admin stats, bookkeeping CSV
db/auth.cjs                # users, quotas, legal consent
lib/emailSend.cjs          # transactional email
lib/legalConsent.cjs       # consent recording
src/App.jsx                # main analysis form + report
src/admin/                 # admin SPA
src/pages/auth/            # register, login, verify, accept-legal
src/pages/legal/           # privacy, terms, disclaimer pages
```

---

## 16. What is NOT built yet (common asks)

- Native iOS/Android apps (web + PWA `sw.js` only)
- OAuth (Google/GitHub login) — email/password only
- Stripe Tax / automatic JP consumption tax on invoices — operator self-manages tax
- Lawyer-reviewed legal text — template only (`docs/LEGAL-NOTES.md`)
- `support@wenap.app` email routing — documented, optional Cloudflare Email Routing
- Full GDPR cookie banner — minimal localStorage only

---

## 17. How to verify production works

```text
GET  https://wenap.app/health
GET  https://wenap.app/api/billing/config     → configured: true
GET  https://wenap.app/api/auth/email-status  → configured: true, transport: resend
GET  https://wenap.app/api/auth/legal-versions
```

Manual: register (3 checkboxes) → email link → analyze on `/app` → upgrade on `/pricing` (subscription checkbox) → Stripe.

---

## 18. Instructions for Claude when editing this codebase

1. **Do not break** Stripe webhook raw body route (`express.raw` on `/api/billing/webhook` only).
2. **Legal changes** require bumping `lib/legalVersions.cjs` so existing users hit `/accept-legal`.
3. **Price IDs** must be `STRIPE_PRICE_PRO` / `STRIPE_PRICE_PRO_PLUS`, not `STRIPE_PRICE`.
4. **Admin API** paths use `/admin-api` prefix on server; frontend uses `/admin/...` with rewrite in `adminApi.js`.
5. **Minimal diffs** — match existing `.cjs` backend + JSX frontend patterns.
6. **Never commit** secrets; `.env` is local only.

---

*Last updated: 2026-05-21 (reflects commits through legal consent + finance admin ~ff337df).*
