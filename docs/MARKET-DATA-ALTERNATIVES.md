# Wenap 行情数据源替代调研（商业授权 · 按价格排序）

> 调研日期：2026-05  
> 背景：Alpha Vantage 免费 Key 默认 **personal, non-commercial**；Wenap 为向付费用户展示行情的 **B2C SaaS**，需商业授权。  
> 本文只列 **条款或官网写明可商业/企业用途** 的方案；「免费档」单独说明，**不能**当作 Wenap 生产的合规方案。

---

## 1. Wenap 现在从 Alpha Vantage 要什么（换源不能少）

| 能力 | AV 接口 | Wenap 用途 |
|------|---------|------------|
| 现价、成交量、最近交易日 | `GLOBAL_QUOTE` | 锁定 `currentPrice`、Hero、情景图、RR |
| 公司名、交易所、行业、ETF 识别 | `OVERVIEW` | 身份、维度、ETF 纠偏 |
| 52 周高低、50/200 日均线 | `OVERVIEW` 字段 | 技术位、完整性检查、prompt |
| 市值、P/E、分析师目标价等 | `OVERVIEW` | prompt、analyst 行 |
| 日 K 序列 | `TIME_SERIES_DAILY` | 现价回补、sparkline、预测核验 cron |

**粗算调用量（生产）：** 每次分析约 **2–3 次** API（Quote + Overview，偶发 Daily）  
- 500 次分析/月 ≈ **1,500–1,500 次/月**  
- 5,000 次分析/月 ≈ **15,000 次/月**  
- 峰值：分析队列并发 3 → 需 **按分钟** 有足够配额（不是只看日限额）

---

## 2. 关于「免费 + 商业」——结论先说

**没有**找到能同时满足下面三条的正规数据源：

1. $0  
2. 官网明确允许 **B2C SaaS 向终端用户展示** 行情/基本面  
3. 覆盖与 AV `GLOBAL_QUOTE` + `OVERVIEW` 相当

各家的 Free / Personal 档几乎都是：**个人、非商业、不可向第三方展示或再分发**。  
「免费替代」只能用于 **本地开发演示**，不能替代 Wenap 生产合规。

---

## 3. 商业授权方案（按「明确可商业」的公开价从低到高）

价格均为 **美元/月**（年付会更低）；**「向用户展示」** 一栏最重要——Wenap 必须在 App 里显示现价等。

| 排序 | 供应商 | 公开商业价 | 商业授权怎么写 | 向用户展示（SaaS） | 与 Wenap 功能覆盖 | 备注 |
|:---:|--------|------------|----------------|-------------------|-------------------|------|
| 1 | **Marketstack** | **$9.99** Basic | 付费档标注 **Commercial Use** | 计划写 Commercial Use；**建议发邮件确认**「付费用户看报告里的现价」是否包含 | ⚠️ 中：EOD + ticker；**深度基本面在 Business $149** | 10,000 次/月；美股源含 Tiingo；[定价](https://marketstack.com/pricing) |
| 2 | **FMP**（Financial Modeling Prep） | **$22** Commercial Starter | 定价页 **Commercial Use** 档；商用 API 许可 | ⚠️ 页面写明：**展示/再分发需单独签 Data Display License** | ✅ 强：Quote、Profile、Key Metrics、SMA、Price Target、EOD | 300 次/分钟；[定价](https://site.financialmodelingprep.com/pricing-plans) · [Enterprise 联系](https://site.financialmodelingprep.com/enterprise-contact) |
| 3 | **Massive**（原 Polygon.io） | **$29** Stocks Starter | 商业数据协议；Nasdaq 许可数据 | ⚠️ Starter 偏延迟行情；**向终端用户展示常需更高档/商务** | ✅ 强（高阶有 Financials） | 无限次/分钟（Stocks）；[定价](https://polygon.io/pricing) · [数据条款](https://polygon.io/legal/market-data-terms-of-service) |
| 4 | **FMP** | **$59** Commercial Premium | 同上 | 同上，需 Display License | ✅ 很强 + 英国/加拿大 | 750 次/分钟 |
| 5 | **Marketstack** | **$49.99** Professional | Commercial Use | 同 Basic，建议书面确认 | ✅ 较好 + 实时美股 | 100,000 次/月 |
| 6 | **Massive** | **$79** Developer | 同上 | 同 Starter，需确认展示权 | ✅ 很强 | IEX 实时等 |
| 7 | **Alpha Vantage** | **$50–250** Premium | 需 **premium@alphavantage.co** 书面商业许可 | 官方：商业用途 **不要** 用免费 Key | ✅ 与现网一致 | 你已在用；[条款](https://www.alphavantage.co/terms_of_service/) · [Premium](https://www.alphavantage.co/premium/) |
| 8 | **FMP** | **$149** Commercial Ultimate | 同上 | Display License | ✅ 最全 | 3000 次/分钟、全球 |
| 9 | **Marketstack** | **$149.99** Business | Commercial Use | 同前；含 Company Details/Ratings | ✅ 接近 AV Overview | 500,000 次/月 |
| 10 | **Massive** | **$199** Stocks Advanced | 同上 | 金融报表端点；展示权需确认 | ✅ 很强 | 全市场 SIP 实时 |
| 11 | **EODHD** | **$399** Internal Use 商业包 | [Commercial pricing](https://eodhd.com/commercial-pricing) | ❌ **仅公司内部用，不可对外展示** | ✅ 基本面很强 | 不适合 Wenap 除非买更高定制 |
| 12 | **Twelve Data** | **$499+** Venture（Business） | [商业用法说明](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) | ✅ Business 允许 **commercial display**（受交易所许可约束） | ✅ 强 | 再分发需单独协议 |
| 13 | **Finnhub** | **询价** Enterprise | [Enterprise = Commercial use + Redistribution](https://finnhub.io/pricing-startups-and-enterprise) | ✅ 面向 SaaS | ✅ 很强 | $49–199 档为 **Personal Use**，不算商业 |
| 14 | **EODHD** | **$2,499** Enterprise 商业 | 商业合同 | 需定制条款 | ✅ 很强 | 量大再用 |

### 不适合 Wenap「对用户展示」的低价项（易误会）

| 供应商 | 标价 | 为何不能当 Wenap 生产方案 |
|--------|------|---------------------------|
| **Tiingo** $50/月 Commercial | 页面写 **Internal Use Only** — 不得 display/share 给个人或组织 | [定价说明](https://www.tiingo.com/about/pricing) |
| **Finnhub** $0–$199 | 公开价均为 **Personal Use**；商业+再分发仅 **Enterprise 询价** | [Stock API 定价](https://finnhub.io/pricing-stock-api-market-data) |
| **Twelve Data** Individual $29–$229 | **禁止** 商业展示给第三方 | 仅 Business 档 |
| 各家 **Free** 档 | 非商业或限额极低 | 仅开发自用 |

---

## 4. 推荐路线（结合 Wenap 现状）

### 方案 A — 改动最小：Alpha Vantage 商业转正

- 发邮件 **premium@alphavantage.co**，说明 Wenap SaaS、月分析量、只展示衍生报告不转售原始 feed。  
- **优点**：零换代码。  
- **缺点**：价格不透明，可能不低于 $50–150/月。

### 方案 B — 性价比 + 功能最全：**FMP Commercial + Display License**（优先考虑）

- 订阅 **Commercial Starter $22/月**（或 Premium $59 若要更多市场）。  
- **必须** 另签 [Data Display and Licensing Agreement](https://site.financialmodelingprep.com/pricing-plans)（页面底部明确要求）。  
- 映射关系：
  - `GLOBAL_QUOTE` → `/quote` 或 batch quote  
  - `OVERVIEW` → `/profile` + `/key-metrics-ttm` + `/price-target-consensus`  
  - 均线 → `/technical-indicators/sma`  
  - `TIME_SERIES_DAILY` → historical price EOD  
- **优点**：功能 ≥ AV，商用档清晰，调用量大。  
- **缺点**：需改 `lib/alphaMarketSnapshot.cjs` 等一层抽象（约 1–2 天）。

### 方案 C — 最便宜商业标称：**Marketstack Basic $9.99**

- 计划已写 **Commercial Use**。  
- **上线前**：邮件问 apilayer/marketstack：*「B2C 订阅用户是否在报告里看到 EOD 现价算 commercial use？」*  
- 若需完整公司基本面 → **Business $149.99**。  
- **优点**：月费低、10k 次对早期够用。  
- **缺点**：功能可能需 **2–3 个 endpoint** 拼 Overview；日 K + 实时弱于 FMP。

### 方案 D — 数据合规最正规、最贵：**Finnhub Enterprise** 或 **Twelve Data Venture+**

- 适合融资后、多市场、要强合规留痕时再上。

---

## 5. 不建议的「免费办法」

| 做法 | 风险 |
|------|------|
| 继续用 AV 免费 Key 跑 wenap.app | 违反 ToS；Stripe 收款后风险更大 |
| Yahoo / 爬虫 / 未授权聚合 | 版权与稳定性问题 |
| 只展示 LLM 编造价格、不拉 API | 准确性/信任灾难 |
| Tiingo $50「商业」档 | 条款禁止对外展示，**不符合** Wenap |

---

## 6. 给你发邮件用的三句（英文）

**Alpha Vantage（premium@alphavantage.co）**

> We operate Wenap (wenap.app), a B2C SaaS that shows AI research reports to paying subscribers. We need a commercial license to use GLOBAL_QUOTE and OVERVIEW (and occasional daily series) server-side only—displayed inside reports, not resold as raw market data. Estimated volume: ___ API calls/month. Please quote commercial terms.

**FMP（enterprise contact）**

> We need Commercial API + Data Display License for wenap.app: show spot price, 52-week range, moving averages, and fundamentals inside user-facing reports. Expected ___ symbol lookups/month. Which plan + display agreement do you recommend?

**Marketstack（contact form）**

> On the Basic plan with “Commercial Use,” may we display end-of-day prices and company metadata to paying users of our web app (not redistributing raw API responses)? Monthly volume about ___ requests.

---

## 7. 代码改造量（若换源）

| 文件/模块 | 作用 |
|-----------|------|
| 新建 `lib/marketDataProvider.cjs` | 统一 `fetchMarketSnapshot(symbol)` |
| `lib/alphaMarketSnapshot.cjs` | 改为调用 provider 或重命名 |
| `server.cjs` | 分析管线入口 |
| `lib/sparkline.cjs` / `lib/alphaPrice.cjs` | 日 K、核验价 |
| `lib/alphaDataCompleteness.cjs` | 字段完整性规则 |

Alpha Vantage 可保留为 fallback，直到新源商业合同生效。

---

## 8. 一句话结论

- **没有** 能替代 AV、又免费、又允许 Wenap 商业展示的正规方案。  
- **早期最稳**：AV 商业许可 **或** FMP Commercial（+ Display 协议） **或** Marketstack Basic（书面确认可对用户展示）。  
- **按公开商业价从低到高**：Marketstack $9.99 → FMP $22 → Massive $29 → … → EODHD/Twelve/Finnhub 企业询价。

*具体价格与展示权以供应商最新条款与书面回复为准。*
