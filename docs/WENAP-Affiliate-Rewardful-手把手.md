# Wenap · Rewardful Affiliate 手把手（按顺序做）

> **目标**：推广者用 `https://wenap.app/?via=他们的token` 带来付费用户，你按 **20% / 25% / 30%** 阶梯付 recurring 佣金。  
> **你要做的**：Rewardful 后台 + 把代码部署到 GCP + 测通一笔 + 邀请推广者。  
> **你不用做的**：自建 Affiliate 后台、手写 Google Sheet 对账（可选备份）。

**预计总时间**：第一次约 **1.5–2 小时**（含等 Stripe / Docker build）。

---

## 开工前检查（2 分钟）

在纸上或备忘录打勾：

- [ ] 能登录 **GCP** 服务器（`wenap-prod`）
- [ ] 能登录 **Stripe Dashboard**（与 wenap.app 收款是 **同一个 Live 账号**）
- [ ] 有一张 **信用卡** 付 Rewardful $49/月（有 14 天 trial）
- [ ] 知道 GitHub 仓库地址（GCP 上 `/opt/wenap/stockai` 能 `git pull`）

**佣金阶梯（记在 Rewardful 里配，不是改代码）**

| 档位 | 条件（该推广者累计有效付费订阅） | 佣金 |
|------|----------------------------------|------|
| Starter | 默认 | **20%** recurring |
| Growth | ≥ 10 | **25%** |
| Partner | ≥ 50 | **30%** |

**定价（不变）**：Pro **$9.99/月** · Pro+ **$19.99/月**

---

# 第 0 步 · 把 Rewardful 代码弄到服务器（约 15 分钟）

> 代码已在本地写好，但 **还没 push 到 GitHub** 的话，服务器 `git pull` 拉不到。二选一。

### 方案 A：从你这台 Windows 电脑 push（推荐）

1. 打开 **PowerShell**，进项目目录：

```powershell
cd "c:\Users\Yap Wei Jun\Downloads\app開発\stockai"
git status
```

2. 确认有这些改动：`src/lib/rewardful.js`、`src/main.jsx`、`src/pages/PricingPage.jsx`、`routes/billing.cjs`、`Dockerfile`、`deploy/docker-compose.gce.yml`、`.env.example`

3. 提交并推送（消息可照抄）：

```powershell
git add src/lib/rewardful.js src/main.jsx src/pages/PricingPage.jsx routes/billing.cjs Dockerfile deploy/docker-compose.gce.yml .env.example docs/WENAP-Affiliate-Rewardful-上线指南.md docs/WENAP-Affiliate-Rewardful-手把手.md
git commit -m "Add Rewardful affiliate tracking for Stripe Checkout"
git push
```

4. SSH 登录 GCP，拉代码：

```bash
cd /opt/wenap/stockai
git pull
```

看到 `rewardful.js` 等文件更新 → 继续 **第 1 步**。

### 方案 B：暂时不能 push

在 GCP 上手动确认存在 `src/lib/rewardful.js`；没有就从本机用 `scp` 拷过去，或先完成 push 再做后面步骤。

**验收**：在服务器执行：

```bash
ls -la /opt/wenap/stockai/src/lib/rewardful.js
```

文件存在 → ✅

---

# 第 1 步 · 注册 Rewardful 并连 Stripe（约 30 分钟）

### 1.1 注册

1. 浏览器打开：https://www.rewardful.com/
2. 点 **Start free trial** / **Get started**
3. 用你管 Wenap 的邮箱注册
4. 选计划：**Starter $49/mo**（成交额 0% 附加费；trial 内可先不配 payout）

### 1.2 连接 Stripe

1. Rewardful 左侧 **Setup** 或 onboarding 里找 **Connect Stripe**
2. 点 **Connect** → 跳 Stripe OAuth
3. **务必选 wenap.app 正在收 Live 款的那个 Stripe 账号**
4. 授权完成 → 回到 Rewardful，状态应显示 **Connected**

### 1.3 选集成方式

在 Setup / Integration 里选：

- **Stripe Checkout**（Server-side / 服务端创建 Session）

**不要**选 Stripe Payment Links 除非你以后改结账方式。Wenap 用的是 `create-checkout-session` API。

### 1.4 复制公钥（后面要写进 `.env`）

1. Rewardful → **Setup** → **JavaScript snippet**（或 Tracking）
2. 看到类似：

```html
<script async src='https://r.wdfl.co/rw.js' data-rewardful='abc123...'></script>
```

3. 只复制 `data-rewardful='`**`和`**`'` **中间那一段**（公钥，可暴露在前端）
4. 先粘到记事本，标签写 `VITE_REWARDFUL_API_KEY` — **第 3 步**要用

**验收**：Stripe 显示 Connected；你手里有一段 rewardful 公钥 → ✅

---

# 第 2 步 · 建 Campaign + 佣金阶梯（约 20 分钟）

### 2.1 新建 Campaign

1. Rewardful 左侧 **Campaigns** → **New campaign**
2. 填写：

| 字段 | 填什么 |
|------|--------|
| Name | `Wenap Pro & Pro+` |
| Commission type | **Percentage** |
| Recurring | **开启**（订阅每月续费都计佣金） |
| Default rate | **20%** |

3. **Products**：若界面让你选 Stripe 产品，勾选 Wenap 的 **Pro** 和 **Pro+** 订阅 Price（与 Stripe 里一致）

### 2.2 配置阶梯（20 → 25 → 30）

Rewardful 界面可能是 **Commission tiers** / **Performance tiers** / **Plans**（名称因版本略有不同）：

1. 在 Campaign 里找 **Tiers** 或 **Add tier**
2. 设三档（逻辑如下，具体按钮按界面点）：

| Tier 名 | 触发条件 | Rate |
|---------|----------|------|
| Starter（默认） | — | 20% |
| Growth | 10+ paying customers（或 referrals converted） | 25% |
| Partner | 50+ | 30% |

3. **Save** / **Publish** campaign

若暂时找不到 tiers：先 **20% recurring** 上线，之后在 Campaign 设置里补 tiers；不影响追踪代码。

### 2.3 推广者注册页（可选）

**Settings** → **Affiliate signup**：

- 可开 **公开申请页**，或先用 **Invite only**（你手动邀请第一批）

**验收**：Campaign 状态 Active；默认 20% recurring → ✅

---

# 第 3 步 · 服务器加环境变量并部署（约 20 分钟）

> **关键**：`VITE_REWARDFUL_API_KEY` 必须在 **Docker build 时** 打进前端；只改 runtime `.env` 不 rebuild **无效**。

### 3.1 SSH 登录 GCP

```bash
ssh 你的用户@wenap-prod的IP
```

### 3.2 编辑 `.env`

```bash
cd /opt/wenap/stockai
nano .env
```

在文件**末尾**加一行（把值换成第 1 步复制的公钥）：

```env
VITE_REWARDFUL_API_KEY=你从data-rewardful复制的那串
```

保存：`Ctrl+O` 回车，`Ctrl+X` 退出。

确认：

```bash
grep VITE_REWARDFUL .env
```

应输出你刚加的那行（不要把完整 key 发给外人）。

### 3.3 重新 build 并启动

```bash
cd /opt/wenap/stockai
docker compose --env-file .env -f deploy/docker-compose.gce.yml up -d --build
```

等待 build 完成（可能 5–15 分钟）。看日志：

```bash
docker compose -f deploy/docker-compose.gce.yml logs -f wenap --tail 50
```

无报错、`listening` 之类 → `Ctrl+C` 退出日志。

### 3.4 确认 key 已打进前端（可选但推荐）

```bash
docker compose -f deploy/docker-compose.gce.yml exec wenap sh -c "grep -r 'wdfl.co/rw.js' /app/dist 2>/dev/null | head -1"
```

有输出 → 说明前端 bundle 里加载了 Rewardful 脚本逻辑。

**验收**：`https://wenap.app/health` 正常；网站能打开 → ✅

---

# 第 4 步 · 端到端测试（约 15 分钟）

> 用 **真实 Live Stripe** 测会真扣款；可用 **小额 Pro** 测完再在 Stripe 退款，或先用 Rewardful 文档里的 test 流程（若你连的是 test Stripe）。

### 4.1 在 Rewardful 建测试推广者

1. **Affiliates** → **Invite affiliate**
2. 填你自己的另一个邮箱（或小号）
3. 对方收邮件 → 登录 Rewardful → 复制推广链接，形如：  
   `https://wenap.app/?via=xxxxxxxx`

### 4.2 无痕窗口走完整漏斗

1. **Chrome 无痕** 打开上一步链接（必须带 `?via=`）
2. 打开开发者工具 → **Console**，输入：

```javascript
rewardful('ready', function() { console.log('referral=', Rewardful.referral) })
```

几秒后应打印 **referral= 一串 UUID**（不是 null）

3. **注册**新账号 → **登录**
4. 打开 `/pricing` → 点 **Upgrade to Pro**（或 Pro+）
5. 用测试卡完成 Stripe Checkout

### 4.3 在 Rewardful 看归因

1. 等 **1–10 分钟**（Stripe webhook → Rewardful）
2. Rewardful → **Referrals** / **Conversions**
3. 应出现刚才那笔订阅，affiliate 是你的测试账号

**没出现？** → 看本文 **「故障排查」** 一节。

**验收**：Referrals 里有一笔 attributed conversion → ✅ 可以邀请真人推广者了

---

# 第 5 步 · 邀请推广者 + 对外话术（约 10 分钟）

### 5.1 邀请

Rewardful → **Affiliates** → **Invite** → 填对方邮箱。  
对方登录后拿到的链接格式：

```
https://wenap.app/?via=他们的token
```

也可让他们挂：`https://wenap.app/pricing?via=token`（`via` 在任意路径都有效，只要先进站）。

### 5.2 英文招募话术（复制发 DM / 邮件）

```
Hi — I'm opening the Wenap affiliate program.

Wenap: AI structured stock research (~2 min per ticker). Pro $9.99/mo, Pro+ $19.99/mo.
Commission: 20% recurring on subscriptions; 25% after 10 paying referrals, 30% after 50.
Tracking & payouts via Rewardful. #ad · Not financial advice.

If interested, reply with your email and I'll send an invite.
```

### 5.3 和「用户推荐送 30 天 Pro」的关系

- **App 内 Referral**（送天数）= 产品功能，和现金佣金**分开**
- **现金佣金**只走 Rewardful 的 `?via=` 链接

### 5.4 每月你要做的（5 分钟）

1. Rewardful Dashboard 看 **本月新增转化**
2. 月底按 Rewardful 流程 **Approve commissions**（若未开自动）
3. 推广者通过 Rewardful 绑 PayPal/Stripe 收款（或你用 Managed Payouts，另收 3%）

---

# 故障排查

| 现象 | 你怎么查 | 怎么修 |
|------|----------|--------|
| Console 里 `Rewardful` 报错 / 无 rw.js | 无痕打开 wenap.app → Network 搜 `rw.js` | `.env` 缺 key 或 **没 rebuild** → 重做第 3 步 |
| `referral` 一直是 null | 链接没带 `?via=`，或 token 无效 | 用 Rewardful 后台复制的完整链接 |
| Checkout 成功但 Rewardful 无单 | Stripe 是否连对账号；Campaign 是否含该 Price | Rewardful Setup 里 reconnect Stripe；检查 Campaign products |
| 只有首月有佣金 | Campaign 未开 **Recurring** | Campaign 设置里打开 recurring |
| 推广者想要折扣码 | 已开 `allow_promotion_codes` | Stripe 里另建 coupon，与 `?via=` **可并存** |

**手动查后端是否收到 referral ID**（仅调试）：结账前在 Console 应有 UUID；若 null，后端也不会写 `client_reference_id`。

---

# 成本心里账（别忘）

| 项目 | 大约 |
|------|------|
| Rewardful Starter | **$49/月** |
| GCP + Marketstack | **~$27/月** |
| 合计固定 | **~$76/月** |

Affiliate 带来的 Pro，你每月大约净留 **$5–7/人**（扣佣金和 API）。  
**约 7–15 个** affiliate 带来的付费用户，才比较划算盖住 Rewardful 月费。  
Trial 14 天内先邀 2–3 个推广者试跑，再决定是否续费。

---

# 今天执行清单（打印勾选）

```
□ 第 0 步  git push + 服务器 git pull
□ 第 1 步  Rewardful 注册 + Connect Stripe + 复制公钥
□ 第 2 步  Campaign 20% recurring + tiers 25/30
□ 第 3 步  .env 加 VITE_REWARDFUL_API_KEY + docker compose up --build
□ 第 4 步  ?via= 无痕测试 + Referrals 有转化
□ 第 5 步  邀请第 1 个推广者
```

---

*技术细节：`WENAP-Affiliate-Rewardful-上线指南.md` · 手动试点备用：`WENAP-Affiliate-阶梯佣金-两天上线.md`*
