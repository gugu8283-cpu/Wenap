# Wenap Affiliate · 阶梯佣金 · 两天上线清单

> **定价**：Pro **$9.99/月**、Pro+ **$19.99/月** — **暂不涨价**  
> **佣金**（按每个推广者 **累计有效付费订阅** 计档，**recurring**）：  
> - **1–9 人 → 20%**  
> - **10–49 人 → 25%**  
> - **50 人+ → 30%**  
> **阶段**：手动试点（**不开 Rewardful**），付费 ≥15 且推广者 ≥3 再考虑自动化  

---

## 一、两天时间表

### Day 1（准备 · 约 2–3 小时）

| 顺序 | 任务 | 完成打勾 |
|:----:|------|:--------:|
| 1 | Stripe Dashboard 为每位试点推广者建 **Promotion Code**（见 §三） | ☐ |
| 2 | 部署 `allow_promotion_codes` 已开的 Checkout（见 `billing.cjs`） | ☐ |
| 3 | 复制 **Google 记账表**（§五 表头） | ☐ |
| 4 | 写对外 **Affiliate 一页说明**（§七 英文，可贴 Notion / 发 PDF） | ☐ |
| 5 | 准备素材包：`/sample/NVDA` 截图 3 张 + Logo + 两句 pitch | ☐ |

### Day 2（找人 · 约 2–4 小时）

| 顺序 | 任务 | 完成打勾 |
|:----:|------|:--------:|
| 6 | 列出 **20 个** 目标频道（AI/股票/理财，1k–50k 粉） | ☐ |
| 7 | 发 **10 条** DM（§八 模板），目标 **2–3 人回复** | ☐ |
| 8 | 给同意的人：专属码 + 素材 + 佣金表 | ☐ |
| 9 | 定价页 / Settings 确认 Checkout 能填 **Promotion code** | ☐ |
| 10 | 日历：**每月 5 号** 对 Stripe 结上月佣金 | ☐ |

---

## 二、佣金规则（对外原样）

### 计档

- **按推广者单独计**，不跨人合并。  
- **有效付费** = 通过该推广者专属码在 Stripe 完成 **Pro 或 Pro+ 订阅**，且 **30 天内未全额退款**。  
- **累计人数** = 历史上所有有效付费订阅数（退订不删档；若发现欺诈可人工降档）。  
- **佣金基数** = 用户 **实际支付** 的订阅月费（用码折扣后的金额 × 比例）。  
- **Recurring**：用户 **每月续费** 仍按 **当时档位比例** 付佣金，直到用户取消订阅。

### 档位

| 累计有效付费 | Recurring 佣金 |
|:------------:|:--------------:|
| 1–9 | **20%** |
| 10–49 | **25%** |
| 50+ | **30%** |

### 结算

- **周期**：自然月，次月 **1–5 日** 结算上月。  
- **门槛**：当月应付佣金 **≥ $50** 或 **≥ 2 笔有效付费**，否则顺延。  
- **方式**：PayPal 或 Wise（推广者提供账号）。  
- **不包**：Rewardful 月费、Managed Payout 3%（手动付则无）。  

### 禁止

- 承诺收益、必涨、内幕、「稳赚」  
- 省略 **Not financial advice / 非投资建议**  
- Reddit 正文放 affiliate 链（见 `WENAP-Reddit-防删发帖指南.md`）  

---

## 三、Stripe 设置（追踪用）

### 1. 启用 Checkout 优惠码

代码已支持：`create-checkout-session` 带 `allow_promotion_codes: true`。  
部署后，Stripe Checkout 页会出现 **「Add promotion code」**。

### 2. 为每位推广者建码（Dashboard）

**Products → Coupons → Create coupon**

试点期建议（二选一）：

| 方案 | Coupon | 作用 |
|------|--------|------|
| **A 仅追踪** | `once`, **0%  off** 不可用 → 改用 **metadata** | 见方案 B |
| **B 追踪 + 转化（推荐）** | `once`, **10% off first month** | 用户更愿意付；佣金按折后价算 |

**Promotion codes**（每人一个，示例）：

| 推广者 | Code | 绑定 Coupon |
|--------|------|-------------|
| `channel_alpha` | `WENAP-ALPHA` | 10% off 首月 |
| `channel_beta` | `WENAP-BETA` | 同上 |

命名规则：`WENAP-{别名大写}`，登记在记账表。

### 3. 每月对账

Stripe → **Payments** / **Subscriptions** → 筛选 **Promotion code** 列 → 填入 Google Sheet。

---

## 四、你每单大概剩多少（Pro $9.99）

重度用量 + Stripe；佣金按 **实付** 计（示例：首月 10% off → 实付 $8.99）。

| 档位 | 佣金约 | 你约剩/人/月 |
|:----:|:------:|:------------:|
| 20% | $1.80–2.00 | **~$5.3–5.5** |
| 25% | $2.25–2.50 | **~$4.8–5.0** |
| 30% | $2.70–3.00 | **~$4.3–4.5** |

仍为正；量起来后固定成本 $27 易覆盖。

---

## 五、记账表（Google Sheet 表头）

复制为第一行：

```
affiliate_id | display_name | promo_code | email_paypal | tier_count | tier_rate | month | gross_mrr | commission_due | paid_y_n | notes
```

**tier_count**：该推广者累计有效付费人数（每月初更新档位）。  
**tier_rate**：20 / 25 / 30。  
**commission_due**：`gross_mrr × tier_rate`（仅该推广者当月归因订阅之和）。

---

## 六、素材包（发给推广者）

```
Wenap — AI structured stock research in ~2 minutes.
Pro $9.99/mo · Pro+ $19.99/mo · Free 5 reports/mo.

Your code: WENAP-XXXX (10% off first month)
Link: https://wenap.app/pricing

Pitch: Structured radar, scenarios, sources — not a chatbot rant.
Must say: Not financial advice.

Screenshots: [attach 3 from /sample/NVDA or fresh Pro run]
```

---

## 七、Affiliate Program Summary（对外英文 · 可整段发）

```
Wenap Affiliate Program (manual pilot)

Product: AI investment research reports — six-dimension radar, scenarios, key levels.
Pricing: Pro $9.99/mo · Pro+ $19.99/mo · Free tier 5 analyses/month.
Not financial advice. Not a broker.

Commission (recurring, per affiliate):
  • 1–9 paying referrals: 20%
  • 10–49 paying referrals: 25%
  • 50+ paying referrals: 30%

Paid on net subscription revenue after any promo discount.
Payout: PayPal or Wise, monthly (by the 5th), minimum $50 or 2 conversions.

You get: unique promotion code + sample screenshots + short talking points.
You must: disclose #ad / affiliate link; no guaranteed returns.

Interested? Reply with your channel URL and PayPal/Wise email.
```

---

## 八、DM 模板（10 条可复制）

**Subject / 首句：**

```
Hi — I run Wenap (wenap.app), AI structured stock reports for retail investors. 
Looking for 2–3 affiliate partners for a pilot.
```

**正文：**

```
Commission tiers:
• 20% recurring (starts here)
• 25% after you refer 10 paying users
• 30% after 50 paying users

Pro is $9.99/mo. You’d get a unique promo code + assets.
Requires #ad and “not financial advice” in your post.

Open to a 30-second look if your audience is stocks/AI/finance?
```

---

## 九、何时升级 Rewardful

同时满足再开 **$49/月** Rewardful：

- [ ] ≥ **15** 个 Affiliate 归因的 **活跃付费**订阅  
- [ ] ≥ **3** 个推广者每月还在带新单  
- [ ] 手动对账每月 **>1 小时**  

Rewardful 可配置相同 20/25/30 阶梯。

---

## 十、与现有 Referral（送 Pro）的关系

| | Referral `?ref=` | Affiliate 本计划 |
|---|------------------|------------------|
| 奖励 | 30 天 Pro | **现金 %** |
| 对象 | 所有用户 Settings | **签约推广者** |
| 同时用 | 可以并存；Affiliate 以 **Stripe 促销码** 为准算佣金 | |

对外推广 **只强调 Affiliate 码**；普通用户 Referral 可保持关闭 UI（`WENAP_REFERRAL_UI` 默认关）。

---

## 十一、相关文件

| 文件 | 用途 |
|------|------|
| `routes/billing.cjs` | Checkout `allow_promotion_codes` |
| `WENAP-参赛与宣传总览-给AI.md` | 宣传 vs 邪门鬼 |
| `WENAP-Reddit-防删发帖指南.md` | 禁止 affiliate 硬广 |

---

*最后更新：2026-06-15 · 价格不涨 · 手动试点优先*
