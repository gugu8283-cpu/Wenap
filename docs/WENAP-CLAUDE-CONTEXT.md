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

**Orchestrator:** `MobileAnalysisReport.jsx` maps snapshot → sections via `snapshotToMobileReport.js`.

See **§19** for the 2026-05 “report slimming + visual density” pass (tables/bullets, prompt limits, CSS). Do not undo that pass when polishing UI unless the user explicitly asks.

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
lib/mainAnalyzePrompt.cjs  # English main analyze JSON spec (keep in sync with server.cjs)
src/utils/compactReportText.js
src/components/analysis/ReportKvTable.jsx
src/components/analysis/ReportBulletPanel.jsx
src/App.jsx                # main analysis form + report
src/admin/                 # admin SPA
src/pages/auth/            # register, login, verify, accept-legal
src/pages/legal/           # privacy, terms, disclaimer pages
```

---

## 19. Mobile report: text slimming & visual density (2026-05)

**Product intent (for Claude):** Paid users should still get **full facts and quality**; the goal is **less repetition and easier scanning** — not hiding Pro/Pro+ content. Prefer **tables, bullet panels, and mini charts** over long prose blocks. **Keep existing charts unchanged:** `RadarSection` (Chart.js radar), `ScenarioSection` (bull/base/bear bars), supply-chain row layout.

### 19.1 UI presentation rules

| Area | Before (roughly) | After |
|------|------------------|-------|
| Core conclusion | Stacked paragraphs | `headline` + `ExpandableText` (2 lines default); `ifBull` / `ifBear` / `action` → **`ReportKvTable`** |
| Key levels | Bullet list only | If `currentPrice` is finite → **horizontal price bars** (`KeyLevelsSection`); else fallback list |
| Forecast | Long `outlook` paragraph | `ReportBulletPanel` (splits `forecast` + `technicalSnapshot`); **assumption** in KV row |
| Pro fields | Multi-line labels | Action → **KV table**; `keyEvents` → **`ma-mini-table`**; insider → bullets |
| Bull/Bear, Critic, radar dim notes | Often fully expanded | Default **`collapsedLines` 3–4** via `ExpandableText`; user can expand |

**Shared components (reuse, don’t duplicate):**

- `ReportKvTable.jsx` — label/value rows, tones: `bull` \| `bear` \| `action` \| `neutral`
- `ReportBulletPanel.jsx` — uses `src/utils/compactReportText.js` (`splitToBullets`, `firstSentence` available but **not** used on core headline — full headline preserved for quality)
- `ExpandableText.jsx` — `collapsedLines=0` means always full text

**CSS** (`MobileAnalysisReport.css`): `.ma-card--accent`, `.ma-card--soft`, `.ma-kv-table`, `.ma-bullet-panel`, `.ma-mini-table`, `.ma-key-levels-chart`, `.ma-section-title--accent`. Dark mobile style unchanged; polish only.

**Props:** `MobileAnalysisReport` passes `currentPrice={report.currentPrice}` into `KeyLevelsSection`.

### 19.2 Model output limits (prompts)

Tighter caps reduce duplicate prose across sections; **same fact once** rule stays in prompts.

| Field | Limit (zh prompt in `server.cjs` `buildMainJsonPrompt`) | English mirror in `lib/mainAnalyzePrompt.cjs` |
|-------|-----------------------------------------------------------|--------------------------------------------------|
| `detailAnalysis` | 180–260 字 | 180–260 chars |
| `outlook` | ≤72 字; don’t repeat summary/dimensions | ≤72 words |
| `technicalSnapshot` | ≤56 字 | ≤56 words |
| Pro+ `bullBearDebate.*.reason` | ≤72 字 per item, complete sentence | (tier block in `server.cjs` `tierPromptExtensions`) |

**Unchanged chart data:** `dimensions`, `scenarios`, radar/scenario rendering — do not replace with text.

**Cached reports:** 1h analysis cache / old JSON may still contain longer strings; new UI still renders them (tables/bullets/collapse). Shorter copy appears after **re-analyze** (or cache miss).

### 19.3 i18n keys added

Under `report.*` in `zh-CN.json` / `en.json` (and `eventsCol*` in `ja.json`):

- `forecastAssumptionLabel`
- `report.pro.eventsColDate`, `report.pro.eventsColEvent`
- Shorter `report.proPlus.critiqueSub` (subtitle only; critique body unchanged)

### 19.4 File map (this feature)

```
src/utils/compactReportText.js
src/components/analysis/ReportKvTable.jsx
src/components/analysis/ReportBulletPanel.jsx
src/components/analysis/CoreConclusionCard.jsx   # KV + headline expand
src/components/analysis/KeyLevelsSection.jsx   # bar chart vs list
src/components/analysis/ForecastCard.jsx
src/components/analysis/ProFieldsSection.jsx
src/components/analysis/CritiqueSection.jsx
src/components/analysis/BullBearSection.jsx
src/components/analysis/RadarSection.jsx       # dim note collapsedLines 4
src/components/analysis/MobileAnalysisReport.jsx
src/components/analysis/MobileAnalysisReport.css
server.cjs                                     # buildMainJsonPrompt + tierPromptExtensions
lib/mainAnalyzePrompt.cjs                      # English analyze prompt limits
src/i18n/locales/zh-CN.json, en.json, ja.json  # table column labels
```

### 19.5 Instructions for Claude editing reports

1. **Do not** remove `RadarSection` / `ScenarioSection` charts to “save space.”
2. **Do** use `ReportKvTable` / `ReportBulletPanel` for new structured report fields instead of new `<p>` walls.
3. **Do not** truncate paid-user fields in the UI (e.g. don’t `firstSentence()` on `coreConclusion.headline`); slim via **prompt limits** and **layout**.
4. If adding a new text block, set a **prompt max length** in both `server.cjs` (zh) and `mainAnalyzePrompt.cjs` (en).
5. New table columns need i18n in **all** active locales or they fall back to key names.

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
7. **Report UI:** follow **§19** — tables/bullets/mini charts for scanability; don’t regress radar/scenario charts or strip Pro copy in the frontend.

---

*Last updated: 2026-05-20 — §19 report slimming/visual density; prior: legal consent + finance admin (~ff337df).*
