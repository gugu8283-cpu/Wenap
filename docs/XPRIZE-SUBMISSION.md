# Build with Gemini XPRIZE — Submission evidence (Wenap)

> Public site: https://wenap.app  
> Repo path: `stockai/` (monorepo root may be `Wenap`)  
> Hackathon build window: **2026-05-19 – 2026-08-17**

---

## LLM usage (Gemini API requirement)

Wenap uses **multiple LLMs** in production:

| Role | Provider | Model / path |
|------|----------|----------------|
| Main investment report (Free / Pro / Pro+) | OpenRouter | `google/gemini-2.5-flash-lite`, Pro+ hybrid (`lib/proPlusHybridAnalyze.cjs`) |
| **Regulatory / policy dimension fallback (≥1 Gemini API call)** | **Google Gemini API** | `gemini-2.5-flash-lite` via `lib/geminiApiClient.cjs` |
| Market data | Alpha Vantage (+ alt fetchers for crypto/forex) | Not LLM |

**Gemini API call (direct, not OpenRouter):**  
When the primary model’s “policy & regulation” dimension is insufficient, `fetchPolicyRegulationDimension()` in `server.cjs` calls `geminiApiGenerate()` instead of OpenRouter. Logs: `[Wenap] policy-reg via Gemini API (gemini/gemini-2.5-flash-lite)`.  
Recorded in SQLite `analysis_logs.model` as `gemini/gemini-2.5-flash-lite`.

Env: `GEMINI_API_KEY` (from [AI Studio](https://aistudio.google.com/apikey)), `GEMINI_POLICY_ENABLED=1`. Optional Vertex path: `GCP_PROJECT_ID` + `VERTEX_LOCATION`.

**Google Cloud product:** Compute Engine VM + persistent disk (hosting); Gemini API key satisfies the hackathon “Gemini API” LLM requirement.

---

## Product evidence (AI live in production) {#product-evidence}

1. **Code — Gemini API integration**  
   - `lib/geminiApiClient.cjs` — Gemini API client (AI Studio key)  
   - `server.cjs` — `fetchPolicyRegulationDimension()` branches to Gemini API when `GEMINI_API_KEY` is set  

2. **Health check** (after GCP deploy)  
   - `GET https://wenap.app/health` → `geminiApiConfigured: true`, `geminiPolicyEnabled: true`  

3. **Per-analysis logging**  
   - Table `analysis_logs`: `model`, `input_tokens`, `output_tokens`, `cost_usd`, `status`, `created_at`  
   - Admin UI: `/admin` → Analysis logs  

4. **Live user flow**  
   - `POST /api/analyze` (authenticated) → SSE stream → mobile report UI  
   - Public samples: `/sample/NVDA` (cron-refreshed)  

5. **Screenshots** (add under `docs/xprize-screenshots/` before final submit if requested)  
   - Admin analysis log showing `gemini/…` model  
   - Sample report page  

---

## Revenue evidence {#revenue-evidence}

**Reporting period:** 2026-05-19 through submission date (within hackathon window).

| Metric | Amount (USD) |
|--------|----------------|
| **Total revenue (arms-length customers)** | **$0.00** |
| Related-party revenue (founder / family / test accounts) | $0.00 |
| Marketing & customer acquisition spend | $0.00 |

### Revenue by month (arms-length)

| Month (2026) | Revenue (USD) |
|--------------|---------------|
| May | $0 |
| June | $0 |
| July | $0 |
| August | $0 |

**Notes:**

- Stripe Live is configured (Pro $9.99 / Pro+ $19.99); no paying third-party subscribers yet as of last update to this file.  
- Future revenue will appear in Stripe Dashboard and `billing_events` in SQLite.  
- This file will be updated before final Devpost submit if revenue &gt; $0.

---

## GitHub access for judges

Repository shared (read) with:

- `testing@devpost.com`
- `judging@hacker.fund`

---

*Update this document before final submission if deployment, revenue, or screenshots change.*
