# Wenap 参赛与宣传总览（给其他 AI 用）

> **用途**：把 Wenap 可冲项目、时间线、叙事与素材清单放在一处，供其他 AI 续写 Devpost、推文、Pitch、架构图说明时引用。  
> **产品现状**：已上线 https://wenap.app · GCP VM + Docker · Free/Pro/Pro+ · 公开预测追踪 `/accuracy`  
> **最后整理**：2026-06-03

---

## 术语（避免和其他脚本混淆）

| 术语 | 在本仓库里的含义 | 不是 |
|------|------------------|------|
| **宣传鬼** | **第 8 步及对外包装**：多渠道宣传（X / Reddit / note.com 等）、截图、短文案、Demo 视频、架构图、Pitch 叙事；见本文「宣传节奏」与「最建议准备的内容」 | 不是邀请码、不是 Devpost 最终 Submit 本身 |
| **懒惰鬼** | 本地/运维用 API 回归脚本 `scripts/lazy-ghost-run.cjs`，输出在 `docs/lazy-ghost-output/` | 不是第 8 步营销 |

用户对其他人说 **「走宣传鬼」** = 按本文 **第 8 步宣传节奏 + 素材清单** 执行，并强调合规免责与真实产品链接。

---

## 五项目一览表（按时间顺序）

| 顺序 | 项目名称 | 类型 | 截止时间 | 可单人 | 全球线上 | 与 Wenap 最佳匹配点 | 官方链接 |
|:---:|----------|------|----------|:------:|:--------:|---------------------|----------|
| 1 | DeveloperWeek New York 2026 Hackathon | AI Engineering / SaaS / Developer Hackathon | **2026/6/10** | ✅ | ✅ | Infra、Docker、Redis、deployment、AI orchestration | https://dwny-2026-hackathon.devpost.com/ |
| 2 | Google Cloud Rapid Agent Hackathon | AI Agent / Google Cloud Hackathon | **2026/6/11** | ✅ | ✅ | AI routing、multi-step reasoning、agent workflow、critique 流 | https://devpost.com/submit-to/29711-google-cloud-rapid-agent-hackathon/manage/submissions |
| 3 | FutureAI Global Hackathon 2026 | AI Agent / GenAI Hackathon | **2026/7/5** | ✅（1–4 人） | ✅ | Autonomous investment research agent、reasoning、explainability | https://futureai.lokeshloki.in/ |
| 4 | **Build with Gemini XPRIZE** | 全球 AI Startup / Product Challenge | **2026/8/17** 13:00 PDT | ✅ | ✅ | 真实 AI SaaS、startup narrative、长期价值最高 | https://xprize.devpost.com/ |
| 5 | Google for Startups Cloud Program | Startup Credits / Cloud & AI Support | **全年**（无固定截止） | ✅ | ✅ | GCP credits、Gemini credits、startup ecosystem | https://cloud.google.com/startup |

**筛选条件（已全部满足）**：现在还来得及 · 明确可参加 · 单人可 · 全球线上 · 适合 Wenap · 含 Google credits / startup 类机会。

---

## 推荐节奏（按月）

### 6 月（最近，先冲）

1. **DeveloperWeek**（6/10）  
2. **Google Rapid Agent**（6/11）  

原因：截止最近；Wenap 已能提交；无需从零开发。

### 7 月（主攻）

3. **FutureAI**（7/5）  

强化：critique agent · explainability · reasoning · AI workflow narrative。

### 8 月（最认真）

4. **Gemini XPRIZE**（8/17）  

最像真正 **AI startup showcase**；配合演示视频、收入证据、评委 GitHub（第 7 步已完成邀请）。

### 并行（全年）

5. **Google for Startups Cloud Program**  

意义不仅是「免费云」，而是：**GCP credits · Gemini credits · startup ecosystem · Google 背书**。  
Wenap 已具备 early-stage AI SaaS 形态（见下表），比许多申请者成熟。

---

## 每个项目最该展示什么

| 项目 | 最该强调 |
|------|----------|
| DeveloperWeek | Docker · Redis · orchestration · deployment · 生产 GCE |
| Google Rapid Agent | AI routing · critique flow · multi-step reasoning · hybrid Pass1/Pass2 |
| FutureAI | Autonomous investment research agent · 六维雷达 · 情景概率 |
| Gemini XPRIZE | 真实 AI fintech SaaS · 公开 `/accuracy` · 付费档位 · 合规叙事 |
| Google for Startups | 已上线产品 · AI infra · growth · 多资产类别 |

---

## Wenap 当前已具备（供其他 AI 引用）

| 领域 | 状态 |
|------|------|
| 产品阶段 | 已部署 early-stage AI SaaS（wenap.app） |
| 部署 | GCP VM + Docker Compose + 持久盘 + Redis |
| AI 架构 | Pro+ hybrid（Haiku Pass1 + Flash Lite Pass2）· OpenRouter · Gemini 政策维补刀 |
| 数据 | Marketstack + Alpha Vantage fallback · 多市场 ticker |
| 缓存 | Redis · 分析结果缓存 |
| 资产类型 | Stock / ETF / REIT / Forex / Crypto / Commodities |
| SaaS | Free（**5 次/月**分析）· Pro · Pro+（含 AI Screener **20 次/月**） |
| 高级功能 | Compare · Risk alerts · Macro layer · SEC insider / Congress（Pro+ Advanced 附录） |
| 公开透明 | `/accuracy` 预测追踪（30 天验证逻辑） |
| 方向 | Explainable · compliance-first investment research |
| 邀请奖励 | **已关闭**（`WENAP_REFERRAL_REWARDS=0`，UI 已隐藏） |

---

## 推荐定位（Narrative，优先一条）

**主定位（优先使用）**

> **AI-native investment research workspace for retail investors.**

**备选**

- Autonomous AI investment research agent.  
- Explainable AI investment research platform.

**不要过度承诺**

- 非投资建议 · 不保证收益 · 数据 EOD/延迟需交叉核验（报告内已有 freshness / trust warnings）。

---

## 最建议准备的内容（宣传鬼 + XPRIZE 共用）

| 内容 | 重要度 | 说明 |
|------|:------:|------|
| Demo video（90 秒–2 分钟） | ⭐⭐⭐⭐⭐ | 注册 → 分析 NVDA/AAPL → 报告亮点 → `/accuracy` |
| Architecture diagram | ⭐⭐⭐⭐⭐ | 用户 → Caddy → Node → OpenRouter/Gemini → Marketstack/Redis → SQLite |
| Technical storytelling | ⭐⭐⭐⭐⭐ | 英文 500–1000 words（Devpost 第 11 步） |
| AI critique showcase | ⭐⭐⭐⭐ | Critic's corner · 多空对撞 · trust warnings |
| Pitch deck | ⭐⭐⭐⭐ | 10–12 页：问题 / 方案 / demo / 商业模式 / 路线图 |
| GitHub + 文档 | ⭐⭐⭐ | 评委已 invite；README 指向线上 demo |
| 宣传截图 | ⭐⭐⭐⭐ | `/sample/NVDA` 桌面 + 手机各 1 张 |

---

## 宣传鬼：第 8 步执行清单（可复制）

**目的**：竞赛需要真实用户与真实收入叙事；Marketing spend 须记录（含 $0）。

### 固定话术（三语）

**英文**

> Wenap — AI stock research in ~2 min. Free 5 reports/month. Not financial advice.  
> https://wenap.app · https://wenap.app/sample/NVDA

**日文**

> Wenap — AIが個人投資家向けに銘柄レポートを約2分で生成。月5回無料。投資助言ではありません。

**中文**

> Wenap — 输入代码，AI 生成结构化投研报告，免费每月 5 次。非投资建议。

**每条必须带**：产品链接 + 免责。**不要写**邀请送 Pro。

### 第 1 周渠道（按顺序）

| 日 | 渠道 | 动作 |
|----|------|------|
| A | X (Twitter) | 英文 + 链接 + 截图 Post |
| B | Reddit | r/stocks 或 r/investing，先读版规，求反馈口吻 |
| C | note.com | 日文长文 + 截图 |
| D | X | 日文或中文再发一轮 |

### 记录表（每笔 $0 也要记）

| 日期 | 渠道 | 链接 | 花费 $ | 注册数 | 备注 |

### 与仓库内其他文档关系

| 文档 | 内容 |
|------|------|
| `docs/XPRIZE-参赛全流程-手把手.md` | 第 0–12 步操作细节（GCP、Devpost、评委 GitHub） |
| `docs/用户与管理员功能说明.md` | 功能与档位说明 |
| 本文 | **给其他 AI 的总览 + 宣传鬼定义** |

---

## XPRIZE 进度快照（2026-06-03）

| 步骤 | 状态 |
|------|------|
| 0 Devpost 注册 | ✅ |
| 1–6 GCP 部署 / wenap.app | ✅（用户已 pull 部署） |
| 7 GitHub 评委 | ✅ devposttesting + judging@hacker.fund（Pending 正常） |
| 8 宣传 | ⏳ 待执行（= 宣传鬼） |
| 9–11 视频 / 叙事 / 财务证据 | ⏳ |
| 12 Devpost Submit | ⏳ 8/17 前；截止前可改 draft |

---

## 给其他 AI 的简短指令模板

```
你在帮 Wenap（AI 投研 SaaS，已上线 wenap.app）做对外材料。
请读：docs/WENAP-参赛与宣传总览-给AI.md
若用户说「宣传鬼」= 第 8 步多渠道宣传 + Demo/架构/Pitch 素材，不是 lazy-ghost-run.cjs。
产品事实：Free 5 次/月；Pro+ 含 screener 20 次/月；无邀请送 Pro；公开准确率 /accuracy。
语气：合规、可核验、不承诺收益。
```
