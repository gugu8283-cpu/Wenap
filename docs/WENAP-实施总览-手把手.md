# Wenap 实施总览（综合 · 手把手）

> **一句话顺序**：先 **XPRIZE 第 5～6 步收尾** → 再 **产品 Phase A（Marketstack + Redis）** → 然后 **XPRIZE 第 7～12 步**（可与 Phase B 并行）→ 最后 **Phase B/C（Pro / Pro+ 功能）**  
> **截止提醒**：Devpost 正式提交 **2026/8/17 13:00 PDT**  
> 详细竞赛原文：[XPRIZE-参赛全流程-手把手.md](./XPRIZE-参赛全流程-手把手.md)  
> 产品与换源逻辑：[PRODUCT-ROADMAP.md](./PRODUCT-ROADMAP.md)  
> **代测找 bug（你管 UI，我管报告）**：[懒惰鬼.md](./懒惰鬼.md)

---

## 一、总览时间表（全部在一张表）

| 顺序 | 代号 | 何时做 | 做什么 | 完成标志 |
|:---:|------|--------|--------|----------|
| ✅ | 0～4 | 已完成 | Devpost、GCP、VM、部署、Gemini、DNS | `wenap.app/health` 正常 |
| **→** | **5** | **现在** | 数据重启不丢 + Gemini 日志 | 见 [第二部分 A](#part-a-第-5-步) |
| **→** | **6** | **现在** | Stripe Webhook + 停 Render | 见 [第二部分 B](#part-b-第-6-步) |
| — | 7 | 6 完成后（或并行） | GitHub 邀评委 | 两邮箱已 invite |
| — | 8 | 持续 | 宣传、真实用户/收入 | 有注册与可选付费 |
| — | **P-A** | **你说「做 Phase A」之后** | Marketstack + Redis + 代码上线 | 见 [第三部分](#第三部分产品-phase-a商用行情) |
| — | 9～11 | 7～8 月 | 视频、英文材料、财务截图 | 素材齐 |
| — | 12 | 8/17 前 | Devpost Submit | 状态 Submitted |
| — | P-B | Phase A 稳了之后 | FRED、技术指标、Pro 四项 + **转化文案** | Compare/宏观等可用 |
| — | P-C | 更晚 | SEC、Pro+ 四项 + **合规/新手分层** | 内幕/筛选/预警等 |
| — | P-✓ | 各 Phase 上线前 | [用户反应对策检查](./PRODUCT-ROADMAP.md#模拟用户反应--问题与对策已并入计划) | 见 PRODUCT-ROADMAP |

**你现在不要跳去 Phase A**，除非第 5～6 步已打勾。

---

## 二、当前进度勾选（自己打 ✓）

### 已完成（根据你近期操作）

- [x] GCP VM `wenap-prod`、Docker、Caddy、`https://wenap.app`
- [x] `GEMINI_API_KEY`、`/health` → `geminiApiConfigured: true`
- [x] 日志：`Gemini API generate ... web=1`
- [x] 前端 7 种资产（需强刷确认）
- [x] GitHub 已 push `812458a`、`7cee08d`

### 待完成（竞赛线）

- [ ] **第 5 步**：`docker restart` 后用户/历史还在
- [ ] **第 6 步**：Stripe Webhook 成功（GCP 地址）
- [ ] **第 6 步**：Render 旧服务 **Suspend**
- [ ] 第 7～12 步（见 [第四部分](#第四部分xprize-第-712-步索引)）

### 待完成（产品线，以后）

- [ ] Phase A：Marketstack 账号 + 代码 + Redis
- [ ] Phase B / C：见 [PRODUCT-ROADMAP.md](./PRODUCT-ROADMAP.md)

---

# 第二部分：XPRIZE 第 5～6 步（现在做）

> VM 路径一律用 **`/opt/wenap`**（不是 `stockai` 子目录）。  
> Compose 文件：**`/opt/wenap/docker-compose.gce.yml`**

## Part A：第 5 步

**目的**：SQLite 在持久盘上，重启容器不丢用户和分析历史。

### A1 浏览器操作

1. 打开 **https://wenap.app**
2. 若还没有 GCP 上的账号：点 **注册** → 填邮箱密码 → 去邮箱点 **验证链接**
3. 登录 → 资产类型选 **个股** → 输入 **NVDA** → 选 **3 个月** → 点 **生成投研报告**
4. 等报告出来（确认能正常完成）

### A2 SSH 重启容器

1. 打开 **Google Cloud Console** → **Compute Engine** → **VM instances**
2. 找到 **`wenap-prod`** → 右侧 **SSH** → 点 **Open in browser window**（或你用本地终端 `gcloud compute ssh`）
3. 在黑窗口里 **逐行粘贴** 回车：

```bash
cd /opt/wenap
docker compose -f docker-compose.gce.yml restart
sleep 5
curl -s http://127.0.0.1:3002/health | head -c 200
```

### A3 再验证浏览器

1. 回到 **https://wenap.app** → 重新登录（若被登出）
2. 检查：
   - 同一账号还能登录
   - **历史分析**里仍有刚才 NVDA 记录
3. 若用户没了：说明库没挂到 `/mnt/wenap-data`，停做 Phase A，先查 `docker-compose.gce.yml` 的 volumes

### A4 Gemini（你已做过，可再确认）

SSH 里：

```bash
docker compose -f docker-compose.gce.yml logs --tail=30 wenap | grep "Gemini API"
```

应看到：`Gemini API generate ... model=gemini-2.5-flash-lite`

✅ **第 5 步完成标志**：重启后账号 + 历史都在；日志有 Gemini API。

---

## Part B：第 6 步

**目的**：域名、支付、旧托管不打架。

### B1 确认 health（浏览器）

1. 新开标签：**https://wenap.app/health**
2. 确认 JSON 里 `"ok": true`、`"geminiApiConfigured": true`

### B2 确认 VM 环境变量

SSH：

```bash
grep APP_PUBLIC_URL /opt/wenap/.env
```

应包含：`APP_PUBLIC_URL=https://wenap.app`  
若没有：

```bash
nano /opt/wenap/.env
```

加上一行 → **Ctrl+O** 保存 → **Ctrl+X** 退出，然后：

```bash
cd /opt/wenap
docker compose -f docker-compose.gce.yml up -d
```

### B3 Stripe Webhook（要点哪里）

1. 浏览器打开 **https://dashboard.stripe.com**
2. 左上角确认是 **Wenap 对应账户**（Live 模式若已上线用 Live，否则 Test）
3. 右上 **Developers**（开发者）
4. 左侧 **Webhooks**
5. 看列表里 endpoint 是否是：
   - `https://wenap.app/api/billing/stripe/webhook`  
   （若你代码路径不同，以仓库 `routes/billing.cjs` 为准）
6. 点进该 endpoint：
   - **Status** 应为绿 / enabled
   - 点 **Send test webhook** 或看 **Recent deliveries** 最近是否 **200**
7. 若仍是 **Render 旧 URL**：
   - 点 **Add endpoint**（或 Edit）
   - **Endpoint URL** 填：`https://wenap.app/api/billing/stripe/webhook`
   - **Events**：至少选 `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`（与现有配置一致）
   - **Add endpoint** / **Save**
   - 复制新的 **Signing secret**（`whsec_...`）→ 写入 VM `/opt/wenap/.env` 的 `STRIPE_WEBHOOK_SECRET=`
   - 再 `docker compose ... up -d`

### B4 停掉 Render（避免双活）

1. 打开 **https://dashboard.render.com**
2. 登录 → 找到 Wenap **旧 Web Service**
3. 点进服务 → 右上 **Manual Deploy** 旁 **Settings** 或 **Suspend**
4. 选 **Suspend Web Service**（或 Delete，确认已无流量）
5. 确认 Stripe、Cloudflare 都只指向 **GCP IP**

✅ **第 6 步完成标志**：`wenap.app/health` OK；Stripe 对 GCP **200**；Render 已停。

---

# 第三部分：产品 Phase A（商用行情）

> **时机**：第 5～6 步打勾后，且你说要开始换源时再做。  
> **动机**：AV 免费不可商用；AV 商用太贵；**Marketstack Basic $9.99** 可商用但功能少 → 用 Gemini/FRED/指标等补足（见 PRODUCT-ROADMAP）。  
> **本节前半**：你注册账号、拿 Key（现在就能做）。**后半**：等代码合并后 `git pull` 部署（届时文档会写「已实现」）。

## P-A1 注册 Marketstack Basic

1. 打开 **https://marketstack.com/**
2. 右上 **Pricing** → 选 **Basic**（约 **$9.99/month**，带 **Commercial Use**）
3. 点 **Sign Up** / **Subscribe**
4. 填邮箱、付款方式 → 完成订阅
5. 登录 **Dashboard** → 找到 **API Access Key** / **Your API Key**
6. 复制 Key → 记事本，标记为 `MARKETSTACK_API_KEY`

### 建议发一封合规确认邮件（可选但推荐）

- 收件：Marketstack 支持（站内 Contact）
- 大意：*We run Wenap (wenap.app), a B2C SaaS showing end-of-day prices in AI reports to paying users. On Basic Commercial plan, is displaying prices in our web app allowed?*

## P-A2 注册 FRED（Phase A 可先拿 Key，代码 Phase B 用）

1. 打开 **https://fred.stlouisfed.org/**
2. 右上 **My Account** → **API Keys**（或 **https://fredaccount.stlouisfed.org/**）
3. **Request API Key** → 填用途 `Wenap financial literacy app` → 提交
4. 复制 Key → `FRED_API_KEY`

## P-A3 代码上线后：VM 配置（Phase A 开发完成时执行）

SSH：

```bash
cd /opt/wenap
nano .env
```

在文件末尾增加（Key 换成你的）：

```env
MARKETSTACK_API_KEY=你的key
MARKET_DATA_PROVIDER=marketstack
REDIS_URL=redis://redis:6379
# 过渡期可保留，便于回退
ALPHA_VANTAGE_API_KEY=原来的key
FRED_API_KEY=你的fred_key
```

保存后：

```bash
git pull
npm ci
npm run build
docker compose -f docker-compose.gce.yml up -d --build
curl -s http://127.0.0.1:3002/health | python3 -m json.tool
```

期望多几项（实现后）：`marketstackConfigured: true`、`redisConfigured: true`

## P-A4 验证换源是否成功

1. 网站分析 **AAPL** 或 **7203.T**（日股格式以实现为准）
2. SSH：

```bash
docker compose -f docker-compose.gce.yml logs --tail=50 wenap | grep -iE "marketstack|market.data|alphavantage"
```

3. 主行情应走 Marketstack；仅 fallback 时才出现 Alpha Vantage

✅ **Phase A 完成标志**：`/health` 显示 Marketstack；报告现价正常；月费 $9.99 可控。

---

# 第四部分：XPRIZE 第 7～12 步（索引）

| 步 | 做什么 | 点哪里 | 详细文档 |
|----|--------|--------|----------|
| **7** | GitHub 邀评委 | github.com → 仓库 **Settings** → **Collaborators** → Add：`testing@devpost.com`、`judging@hacker.fund` | [手把手 §7](./XPRIZE-参赛全流程-手把手.md) |
| **8** | 宣传获客 | X / Reddit / 日文；**一句反 ChatGPT 差异化** + 样本页 + Stripe 首月优惠 | [手把手 §8](./XPRIZE-参赛全流程-手把手.md) · [对策表](./PRODUCT-ROADMAP.md#模拟用户反应--问题与对策已并入计划) |
| **9** | 录 demo 视频 | 2～3 分钟：登录→分析→六维→Gemini | [手把手 §9](./XPRIZE-参赛全流程-手把手.md) |
| **10** | 英文 Project Story | Devpost 各栏 | [XPRIZE-SUBMISSION.md](./XPRIZE-SUBMISSION.md) |
| **11** | 收入/成本截图 | Stripe、GCP Billing、分析日志 | [手把手 §11](./XPRIZE-参赛全流程-手把手.md) |
| **12** | 正式 Submit | **xprize.devpost.com** → 项目 → **Submit** | [手把手 §12](./XPRIZE-参赛全流程-手把手.md) |

**第 7 步可与 Phase A 并行**（10 分钟）；**第 8 步应与开发并行**，不要等全部功能做完。

---

# 第五部分：产品 Phase B / C（索引）

做完 Phase A 后按 [PRODUCT-ROADMAP.md](./PRODUCT-ROADMAP.md) 顺序。  
**模拟用户反应后的对策**（定价表、免责、语言、延迟标注等）已写入路线图 **[问题与对策表](./PRODUCT-ROADMAP.md#模拟用户反应--问题与对策已并入计划)**，与各 Phase 绑定，勿忘勾选。

| 阶段 | 内容 | 你要做的（概要） |
|------|------|------------------|
| **A** | Marketstack + Redis + 价源/as-of + 日股实测 | 见第三部分；完成时勾 **Phase A 对策检查** |
| **B** | FRED、技术指标、Pro 四项 + **定价页 Pro/反 ChatGPT 文案** | 代码上线 → Pro 账号验收；**懒惰鬼** 跑 `en`/`ja` |
| **C** | Pro+ 四项 + **预警可配、选股免责、进阶 Tab、来源小字** | 分功能验收；国会另定数据源 |

Pro / Pro+ 功能均需 **Stripe 对应 tier** 测试账号（可用 `scripts/createTestAccounts.cjs`）。

### 宣传素材里建议固定带上的三句（对策 #1、#2、#12）

1. **不是聊天炒股**：结构化六维报告 + 现价锚定 + 约 2 分钟。  
2. **Pro / Pro+**：对比/日历/宏观 vs 预警/内幕/国会/选股（**Pro+ 偏美股深度**）。  
3. **首月优惠**（若 Stripe 已配 coupon）+ 非投资建议免责。

---

# 附录 A：常用命令（复制用）

```bash
# SSH 进项目
cd /opt/wenap

# 拉代码 + 重建
git pull && npm ci && npm run build
docker compose -f docker-compose.gce.yml up -d --build

# 健康检查
curl -s http://127.0.0.1:3002/health | python3 -m json.tool

# 看 Gemini
docker compose -f docker-compose.gce.yml logs --tail=40 wenap | grep -i gemini

# 看最近提交
git log -3 --oneline
```

---

# 附录 B：环境变量速查

| 变量 | 用途 | 阶段 |
|------|------|------|
| `GEMINI_API_KEY` | 主分析 + 政策维 | 已用 |
| `OPENROUTER_API_KEY` | Haiku / Pro+ Pass1 | 已用 |
| `ALPHA_VANTAGE_API_KEY` | 行情（待替换） | 现用 → 过渡 |
| `MARKETSTACK_API_KEY` | 商用行情主源 | Phase A |
| `MARKET_DATA_PROVIDER` | `marketstack` / `alphavantage` | Phase A |
| `REDIS_URL` | 缓存 15min | Phase A |
| `FRED_API_KEY` | 宏观数据 | Phase B |
| `APP_PUBLIC_URL` | `https://wenap.app` | 已用 |
| `STRIPE_*` | 付费与 Webhook | 已用 |

---

# 附录 C：数据栈分工（为何这样补 AV）

| 组件 | 月费 | 补什么 |
|------|------|--------|
| Marketstack Basic | $9.99 | 合规现价 + OHLCV |
| Gemini 联网 | 按量 | 新闻、日股基本面、供应链、价兜底 |
| FRED | 免费 | 利率/CPI/失业 |
| SEC EDGAR | 免费 | 财报、Form 4 |
| 自算指标 | 免费 | RSI/MACD 等 |
| Redis | 免费 | 少打 API、加速 |
| 情绪时序（自研） | 免费 | Pro 30 日情绪图 |

---

**文档维护**：Phase A 代码合并到 `main` 后，在本文 P-A3 标题旁注明 commit 号。开发前Say：「按 WENAP-实施总览 做 Phase A 代码」。
