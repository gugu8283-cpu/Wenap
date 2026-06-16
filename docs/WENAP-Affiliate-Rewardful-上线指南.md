# Wenap · Rewardful Affiliate 上线指南

> **定价**：Pro $9.99 · Pro+ $19.99（暂不涨价）  
> **佣金阶梯**（在 Rewardful 后台配置，非代码）：  
> - 1–9 有效付费 → **20%** recurring  
> - 10–49 → **25%**  
> - 50+ → **30%**  
> **平台费**：Rewardful Starter **$49/月**（成交额 **0%** 附加费；可选 Managed Payouts 另收 3%）  

---

## 你需要什么「程式」？

| 部分 | 谁做 |
|------|------|
| 推广者注册、链接、佣金、打款 | **Rewardful**（网页后台） |
| 追踪 `?via=` 访客 | **已集成** `src/lib/rewardful.js` + `index` 入口加载 |
| 结账归因 Stripe | **已集成** Checkout 传 `client_reference_id` |
| 阶梯 20/25/30% | **Rewardful Campaign** 里点选配置 |
| 你不需要 | 自建 Affiliate 后台、Google Sheet 对账（可选保留备份） |

---

## 一、Rewardful 后台（Day 1 · ~1 小时）

### 1. 注册并连 Stripe

1. https://www.rewardful.com/ → Start trial  
2. **Connect Stripe**（与 wenap.app 同一 Live 账号）  
3. 选 **Server-side Stripe Checkout** 集成方式  

### 2. 建 Campaign

- **Name**：`Wenap Pro & Pro+`  
- **Commission**：Recurring（订阅每月续费都计）  
- **Tier structure**（按推广者累计转化数升档 — 在 Rewardful 用 Commission Tiers / Plans）：

| 档位 | 条件 | Rate |
|------|------|------|
| Starter | 默认 | 20% |
| Growth | ≥10 paying customers | 25% |
| Partner | ≥50 paying customers | 30% |

（界面名称因 Rewardful 版本略有不同；核心是 **performance tiers**。）

### 3. 复制 API Key

Setup → **JavaScript snippet** → 复制 `data-rewardful='xxxx'` 里的 **公钥**。

### 4. 邀请推广者

Affiliates → Invite → 对方登录 Rewardful 拿链接：  
`https://wenap.app/?via=their-token`

---

## 二、Wenap 部署（Day 1 · ~15 分钟）

### 1. 环境变量

在 **GCP** `/opt/wenap/stockai/.env` 增加（构建时需注入前端）：

```env
VITE_REWARDFUL_API_KEY=你的_rewardful_公钥
```

**注意**：`VITE_` 变量在 **`npm run build` 时** 打进前端，改 `.env` 后必须 **重新 build**。

### 2. 部署

```bash
cd /opt/wenap/stockai
# .env 里必须有 VITE_REWARDFUL_API_KEY=...
docker compose --env-file .env -f deploy/docker-compose.gce.yml up -d --build
```

（`VITE_` 变量必须在 **build 时** 传入；仅 runtime `env_file` 不够。）

### 3. 验收

1. 浏览器打开 `https://wenap.app/?via=test`（用 Rewardful 里一个测试 affiliate 的 token）  
2. 注册 → 登录 → `/pricing` → Upgrade Pro  
3. 完成测试结账（可用 Stripe test mode 若 Rewardful 连的是 test）  
4. Rewardful Dashboard → **Referrals** 应出现 attributed conversion  

---

## 三、代码已做的事（不用你再写）

```
访客 ?via=affiliate
    → rewardful.js 加载 rw.js，写入 cookie
    → 用户点 Upgrade
    → getRewardfulReferralId() 取 UUID
    → POST /billing/create-checkout-session { rewardfulReferral }
    → Stripe session.client_reference_id = UUID
    → Rewardful 从 Stripe webhook 归因 → 算佣金
```

相关文件：

- `src/lib/rewardful.js`  
- `src/main.jsx` → `initRewardful()`  
- `src/pages/PricingPage.jsx`  
- `routes/billing.cjs`  

---

## 四、与旧方案的关系

| | Rewardful | 手动促销码 Sheet |
|---|-----------|------------------|
| 追踪 | 自动 | Stripe 里人工看码 |
| 佣金 | 自动算 | 自己算 20/25/30% |
| 月费 | $49 | $0 |
| `allow_promotion_codes` | 仍开着，可叠加强力活动码 | 可保留 |

**用户 Referral（送 30 天 Pro）** 与 Rewardful **分开**；现金佣金只走 Rewardful `?via=`。

---

## 五、推广者对外话术（英文）

```
Join the Wenap affiliate program — AI structured stock research.
Pro $9.99/mo · 20% recurring (25% after 10 referrals, 30% after 50).
Dashboard + payouts via Rewardful. #ad · Not financial advice.
Apply: [你的 Rewardful 邀请链接或邮件]
```

---

## 六、成本提醒

- 固定：**$49/月** Rewardful + **~$27** 服务器行情  
- 约 **≥7–10 个** Affiliate 带来的付费订阅，才盖住 Rewardful 月费  
- 量少时可先 **14 天 trial** 验证再续费  

---

## 七、故障排查

| 现象 | 检查 |
|------|------|
| Rewardful 无转化 | `VITE_REWARDFUL_API_KEY` 是否 build 进 dist；是否 `?via=` 进站 |
| Checkout 无归因 | 浏览器 Console → `Rewardful.referral` 是否有值 |
| 只有首月有佣金 | Campaign 是否设为 **Recurring** |
| 生产无 key | 本地 `.env` 有但 Docker build 未传 — 需在 build 前写入 `.env` |

---

*相关： `WENAP-Affiliate-阶梯佣金-两天上线.md`（手动试点备用）*
