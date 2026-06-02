# Wenap 产品路线图（备忘）

> **逐步操作（竞赛 + 换源 + Phase A/B/C）** → [WENAP-实施总览-手把手.md](./WENAP-实施总览-手把手.md)  
> 竞赛原文 → [XPRIZE-参赛全流程-手把手.md](./XPRIZE-参赛全流程-手把手.md)  
> 最后更新：2026-05-30

---

## 为什么要换源（核心动机）

Wenap 是 **向付费用户展示行情与报告的 B2C SaaS**，必须 **商用合规**。

| 方案 | 问题 |
|------|------|
| **Alpha Vantage 免费 Key** | 条款为 **personal, non-commercial**，不能用于 wenap.app 生产环境 |
| **Alpha Vantage 商业授权** | 需联系 premium@，价格通常 **$50+/月** 且不透明，超出当前负担 |
| **Marketstack Basic** | 约 **$9.99/月**，付费档标明 **Commercial Use**，是目前能负担的、**条款上明确可商用** 的行情方案 |

**矛盾：** Marketstack Basic **功能不如 AV 齐全**（尤其 `OVERVIEW` 级基本面、部分实时字段、与日 K 组合的便利度）。  
**策略：** 以 **Marketstack 作唯一合规行情主源**，用 **免费/已有手段分工补齐** AV 曾经提供的部分能力——不是重复堆 API，而是 **各管一块**。

crypto / forex / commodities **不经过此次替换**，继续 CoinGecko、ExchangeRate-API 等现有链路。

---

## Alpha Vantage 能力 → 由谁补齐

| 原 AV 能力 | Wenap 用途 | 主替代 | 弥补手段 |
|------------|------------|--------|----------|
| `GLOBAL_QUOTE` 现价、量 | Hero、情景价、RR | **Marketstack** EOD/报价 | 延迟时 **Gemini 搜索** 兜底（短 prompt，限 1 次） |
| `OVERVIEW` 公司名、交易所、行业 | 身份、ETF 纠偏 | Marketstack ticker 元数据（有限） | **Gemini** 日股/美股基本面检索；prompt 内 identity |
| `OVERVIEW` 52 周、均线、P/E、市值 | 技术位、完整性 | **OHLCV → 自算指标**（见下） | 缺字段时 Gemini 补充叙述，不编造数字 |
| `TIME_SERIES_DAILY` 日 K | sparkline、cron | **Marketstack 历史 OHLCV** | Redis 缓存序列 |
| 宏观利率/CPI 等 | （原较弱） | — | **FRED API** |
| 财报日期、Form 4 | （原无） | — | **SEC EDGAR**（结构化 API，非 search-index） |
| 新闻与情绪 | Gemini 已在用 | — | **Gemini 联网** + Pro **情绪时序（自有算法 + DB）** |
| 产业链 | Gemini 已在用 | — | **供应链 JSON（Gemini 生成，已有）** |
| 调用频控 | 内存缓存 | — | **Redis 15min** 统一缓存行情/宏观/SEC |

实施时建议 **短期保留 AV 作 fallback**（`MARKET_DATA_PROVIDER=marketstack|alphavantage`），Marketstack 稳定后再关。

---

## 数据与技术栈总表（手段 · 用途 · 成本 · 角色）

| 组件 | 技术手段 | 用途（补 AV 哪一块） | 角色 | 月固定成本 | 单次分析边际 |
|------|----------|----------------------|------|------------|--------------|
| **Marketstack Basic** | REST：EOD/报价/OHLCV | 合规 **主行情**；历史 K 线 | **主源** | **$9.99** | ~$0（摊入月费） |
| **技术指标库** | Marketstack OHLCV → RSI/MACD/布林/EMA/SMA（`technicalindicators` 或 ta-lib） | 补 AV Overview 里的技术位、均线 | **算力层** | $0 | ~$0 |
| **Gemini 2.5 + 联网** | `geminiApiGenerate(..., useWeb: true)` | 新闻情绪、日股基本面日文、供应链、**现价兜底**、政策维 | **补全 / 叙述** | $0 | **~$0.01～0.03**（已含在主报告） |
| **FRED API** | `series/observations` | 利率、GDP、通胀、失业；Pro 宏观影响 | **宏观硬数据** | $0 | ~$0（缓存后） |
| **SEC EDGAR** | `data.sec.gov` submissions / Form 4 等 | 美股财报日历、内部人交易（Pro+） | **美股事件事实** | $0 | 低（缓存） |
| **Redis** | `ioredis`，TTL 15min | 减 Marketstack/FRED/SEC 重复请求；重启不丢缓存 | **基础设施** | $0（自建） | ~$0 |
| **情绪时序** | **自有算法**（规则/词典）+ SQLite 日度分；可选低频 Gemini 校准 | Pro 30 日情绪折线图 | **产品层** | $0 | 避免「每日全量 Gemini 扫新闻」 |
| **供应链图谱** | 主分析 prompt → `supplyChain` JSON | 产业链块（已有） | **已有** | $0 | 含在 Gemini 主分析内 |

### 和「只用一个 API」的差别

- **Marketstack** 负责 **可缓存、可商用的数字**（价、量、K 线）。  
- **Gemini** 负责 **文字、新闻、日文基本面、搜索兜底**——**不**当唯一现价源（贵、不稳）。  
- **FRED / SEC** 负责 AV **本来就没有或很弱**的宏观与美股事件。  
- **自算指标 + 情绪算法** 负责 AV Overview **里那些字段**，避免为基本面升 Marketstack Business（$149）。

---

## 产品功能层（Pro / Pro+）

在数据栈之上，用 **tier 门禁** 卖功能（与行情替换正交，分阶段做）。

### Pro（$9.99/月）

1. **多股对比** — ≤3 支；Recharts 雷达叠加；六维并排（增强现有 `/compare`）  
2. **情绪趋势图** — 30 日；依赖 **情绪时序 DB + 自有算法**（**crypto 用户主卖点之一**）  
3. **财报日历** — SEC / 日历数据；即将发布提醒（**美东日期 + 来源标注**）  
4. **宏观影响** — **FRED 数字 + 一次 Gemini 解读**（Fed 变化可 cron 触发，非实时轮询）  

**对策（转化）**：定价页写清 vs ChatGPT；可选对比页导出 CSV（见上表 #16）。

### Pro+（$19.99/月）

1. **国会议员交易追踪** — 需 **单独数据源**（非 EDGAR search-index）+ **来源页脚**  
2. **内部人信号** — SEC Form 4 + **非投资建议提示**  
3. **AI 选股器** — 自然语言 → Top 5（Gemini 联网 + **大字免责 + 月限次**）  
4. **风险预警** — 价跌 / 异常量 / 负面新闻；**默认关、阈值可配**、自选启用  

**对策（定位）**：对外写明 **偏美股/ETF 深度**；与 Pro 分界见上表 #2、#11。

---

## 实施顺序（赛后或 5～6 步后）

| 阶段 | 数据 / 功能 | 目标 |
|------|-------------|------|
| **A** | Marketstack adapter、Redis、`.env` / `/health`、书面确认 Commercial 展示权 | **合规上线主行情** |
| **A′** | 信任与表述（见下表「对策」） | 让用户敢信现价、知延迟 |
| **B** | FRED、技术指标进 prompt、Pro：对比雷达 + 财报日历 + 宏观块 | **补齐常用投研维度** |
| **B′** | 转化与文案（定价表、反 ChatGPT、首月优惠） | 提高 Pro 转化 |
| **C** | SEC 结构化、情绪 DB、Pro+：内幕 → 选股器 → 国会 / 预警 | **高阶付费理由** |
| **C′** | 合规呈现、新手分层、预警可配置 | 降低误报与合规风险 |

> **A′/B′/C′** 不单独排期，并入同阶段开发或同阶段上线前检查清单。

---

## 模拟用户反应 → 问题与对策（已并入计划）

> 来源：多角色虚拟焦点小组（假设 **本路线图功能均已上线**）。  
> 对策写入各 Phase；竞赛宣传见 [WENAP-实施总览](./WENAP-实施总览-手把手.md) 第 8 步。

| # | 用户常提的问题 | 对策（做什么） | 并入阶段 |
|---|----------------|----------------|----------|
| 1 | 「和直接问 ChatGPT 有啥区别？」 | 首屏 + 定价页固定一句：**结构化六维 + 锁定现价与来源 + 2 分钟成报告**；样本页 `/sample/NVDA` 作对比 | **B′**（文案）；第 8 步宣传 |
| 2 | 分不清 Pro / Pro+ | 定价页 **一张对比表**：Pro=对比/日历/宏观/情绪；Pro+ = 预警/内幕/国会/选股；标注 **Pro+ 偏美股深度** | **B′** 上线前；**C** 功能齐后再改一版 |
| 3 | 功能太多，新手懵 | 默认 **简洁报告流**；国会/选股/内幕进 **「进阶 / Pro+」** 折叠，不堆首页 | **C′** UI |
| 4 | 英文模式报告里出现中文 | `outputLocale` + 主分析 prompt 强化；上线用 **懒惰鬼** 跑 `en`/`ja` 抽检 | **A** 起持续；**B** 前必过 |
| 5 | 日股：现价/币种/用语不对 | Marketstack **`.T` ticker** 实测（如 7203.T）；Hero **JPY**；Gemini 日文基本面仅作补叙述 | **A** |
| 6 | 行情是不是实时？信不信 | Hero 显示 **价源 +  as-of 时间**；Basic 为 **EOD/延迟** 时 UI **明确写清**（勿写 real-time） | **A′** |
| 7 | 数据胡编、没出处 | 行情走 Marketstack；宏观标 **FRED**；财报/内幕标 **SEC**；Pro+ 每块 **小字数据来源** | **A′** **B** **C′** |
| 8 | 预警怕吵、怕误报 | 预警 **默认关** 或仅邮件；阈值 **可配置**（跌幅%/量）；自选才启用 | **C** **C′** |
| 9 | AI 选股怕荐股、合规 | 选股结果页大字：**非投资建议 / 研究用**；Pro+ **每月限次** 防刷；Top5 必带理由+来源 | **C′** |
| 10 | 国会追踪是不是噱头 | 选用 **正经披露数据源**（非 EDGAR search-index）；页脚 **来源说明** | **C** |
| 11 | 只玩币的人觉得 Pro+ 无用 | 定价写清 **Pro+ 美股深度**；**Pro** 卖点含 crypto **情绪曲线**（若已做 BTC） | **B** **B′** |
| 12 | 学生/价格敏感 | Stripe **首月优惠券**；免费 **5 次/月** 保留 | **B′** + 第 8 步 |
| 13 | 怀疑派要核验 | 允许用熟悉标的 **交叉验证**；分析日志/admin 可对内查 model/价源（不需对外） | **A′** |
| 14 | 早期用户怕烂尾 | `/about` 或 Devpost 写 **changelog / 路线图**（链到 PRODUCT-ROADMAP 摘要） | 第 **8～11** 步 |
| 15 | 财报日时区混乱 | 财报日历 **美东日期** + 用户本地时区注释 | **B** |
| 16 | 重度用户要对比导出 | 对比页 **导出 CSV/PDF**（可选，非阻塞） | **B** 有余力再做 |

### 各阶段上线前必勾（对策检查）

**Phase A 完成时**

- [ ] 日股/美股各 1 标的现价与交易所显示正确  
- [ ] Hero 有 as-of + EOD/延迟说明  
- [ ] `locale=en` 报告主体无大段中文（懒惰鬼 抽检）  

**Phase B 完成时**

- [ ] 定价页 Pro 四项与功能一致；`/compare` 3 股雷达可用  
- [ ] 财报日历、宏观块有 FRED/SEC 来源小字  
- [ ] 首屏/定价回答「vs ChatGPT」  

**Phase C 完成时**

- [ ] Pro+ 对比表与国会/选股/预警一致；美股范围写清  
- [ ] 选股/预警免责与限次  
- [ ] 新手界面不默认堆 Pro+ 复杂块  

---

## 成本粗算（与负担一致）

| 项目 | 月费 |
|------|------|
| Marketstack Basic | $9.99 |
| FRED + SEC + Redis + 指标库 + 自研情绪 | $0 |
| Gemini（按量） | 视分析量；目标单次股票 **~$0.01～0.03** |
| **合计固定** | **约 $10/月** + Gemini 变量 |

Pro 多股对比应用 **1 次合并 Gemini prompt + 3 路 Marketstack**，避免 3 倍 LLM 费用。

---

## 环境变量

```env
MARKETSTACK_API_KEY=
FRED_API_KEY=
REDIS_URL=
# 过渡期可选
MARKET_DATA_PROVIDER=marketstack
# 保留至切换完成
# ALPHA_VANTAGE_API_KEY=
# 现有不变
GEMINI_API_KEY=
OPENROUTER_API_KEY=
```

---

## 不变原则

- 流式输出、六维 prompt、Stripe、免费额度逻辑保持  
- **Gemini API** 主分析；**OpenRouter** 仅 Haiku（Pro+ Pass1 等）  
- 所有新功能 **tier 校验**  
- 向用户展示的行情以 **Marketstack 许可证** 为准；上线前发邮件确认 Basic 档 SaaS 展示范围  

---

## 相关文档

- [MARKET-DATA-ALTERNATIVES.md](./MARKET-DATA-ALTERNATIVES.md) — 商用数据源比价与 AV 字段清单  
- [XPRIZE-参赛全流程-手把手.md](./XPRIZE-参赛全流程-手把手.md) — 竞赛步骤  
