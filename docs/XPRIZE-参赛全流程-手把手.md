# Build with Gemini XPRIZE — Wenap 参赛全流程（手把手）

> **竞赛**：Build with Gemini XPRIZE · **截止**：2026/8/17 13:00 PDT  
> **赛道**：Money & Financial Access  
> **产品**：Wenap（AI 个人投研报告）  
> **技术路线**：GCE 常开 VM + 持久盘 + **OpenRouter 主分析** + **Gemini API 政策维补刀**（AI Studio 密钥，无需 Vertex）  
> **今天日期参考**：2026-05-29  

按下面 **第 0 步 → 第 12 步** 顺序做，不要跳。某步未完成，后面可能白做。

---

## 总览时间表

| 阶段 | 何时做 | 内容 |
|------|--------|------|
| **0–2** | 第 1 天 | 注册 Devpost + GCP + 开 VM |
| **3–5** | 第 2–3 天 | 部署 Wenap + Gemini API + 验证数据不丢 |
| **6** | 第 3 天 | DNS 切到 GCP |
| **7** | 第 4 天起 | **宣传**（与 8 并行，持续） |
| **8** | 第 4 天起 | 获客、付费、收集 testimonial |
| **9–11** | 7 月–8 月初 | 视频、英文叙事、财务证据 |
| **12** | 8/17 前 | Devpost 正式提交 |

---

# 第 0 步：Devpost 注册（30 分钟）

**目的**：正式加入竞赛，收邮件通知。

1. 浏览器打开：**https://xprize.devpost.com/**
2. 右上角点 **「Join hackathon」**（或 **Register**）。
3. 若无 Devpost 账号：
   - 点 **Sign up**
   - 用 **邮箱** 或 **GitHub** 注册
   - 去邮箱点 **验证链接**
4. 若已有账号：点 **Log in** → 登录。
5. 回到竞赛页，再点 **Join hackathon**。
6. 填表单（有就填，没有可后改）：
   - **Project name**：`Wenap` 或 `Wenap Financial Access`
   - 其他能跳则跳，**先完成注册**
7. 确认页面显示 **You’re registered** 或右上角不再提示 Join。
8. **不要**今天填最终 Submission（8/17 才交）。

✅ **完成标志**：能登录 Devpost，竞赛页显示你已加入。

---

# 第 1 步：Google Cloud 账号 + $300 试用（30 分钟）

**目的**：Google Cloud 产品（GCE 托管）+ 可选启用控制台里的 Gemini API。

1. 打开：**https://cloud.google.com/free**
2. 点 **「Get started for free」** 或 **「开始免费试用」**。
3. 用 **Gmail** 登录（建议专门做 Wenap 的 Google 账号）。
4. **国家**：选 **Japan**。
5. **帐户类型**：个人 / 个人事业主 选 applicable 项。
6. **付款方式**：填 **信用卡或借记卡**（仅验证，试用期内不会自动扣到满额）。
7. **创建项目**：
   - 项目名称：`Wenap Production`
   - 记下 **项目 ID**（例如 `wenap-prod-123456`）→ 抄到记事本，后面叫 **`GCP_PROJECT_ID`**
8. 等页面出现 **「$300 credit」** 或 Billing 里 **Free trial** 状态。
9. 设预算告警：
   - 左侧菜单 **☰** → **Billing（结算）**
   - 左侧 **Budgets & alerts（预算和提醒）**
   - **CREATE BUDGET**
   - 名称：`wenap-alert`
   - 金额：**$50** 和 **$100** 各建一条（或一条 $100）
   - 邮箱勾选你的 Gmail → **Finish**

✅ **完成标志**：Billing 显示 Trial，项目 ID 已记下。

---

# 第 2 步：启用 API + 创建 GCE 虚拟机（45 分钟）

**目的**：常开后端 + 持久盘（**不用 Cloud Run**）。

## 2.1 启用 API

1. 顶部搜索栏输入 **`APIs & Services`**
2. 点 **「库」/ Library**
3. 搜索 **`Compute Engine API`** → 点进去 → **启用 / Enable**
4. 返回库，搜索 **`Gemini API`** 或 **`Generative Language API`** → **启用**（可选；**政策维补刀用 AI Studio 密钥即可**，见第 4 步 `GEMINI_API_KEY`）
5. （可选）搜索 **`Cloud Resource Manager API`** → 若未启用则启用

## 2.2 创建 VM

1. 搜索栏输入 **`Compute Engine`** → 点 **VM instances**
2. 若提示启用 API，点 **Enable** 并等待
3. 点 **「CREATE INSTANCE」/「创建实例」**
4. 填：

   | 字段 | 填什么 |
   |------|--------|
   | Name | `wenap-prod` |
   | Region | `asia-northeast1 (Tokyo)` |
   | Zone | 任选一个，如 `asia-northeast1-a` |
   | Machine type | **e2-small**（2 vCPU, 2 GB memory） |
   | Boot disk | **Change** → Ubuntu **22.04 LTS** → **10 GB** |
   | Firewall | ✅ **Allow HTTP traffic** ✅ **Allow HTTPS traffic** |

5. 点 **「SHOW ADVANCED OPTIONS」/「显示高级选项」** 展开。

## 2.3 添加持久数据盘（重要）

1. 高级选项里找到 **「Disks」/「磁盘」** 标签
2. 点 **「ADD NEW DISK」/「添加新磁盘」**
3. 填：

   | 字段 | 填什么 |
   |------|--------|
   | Name | `wenap-data` |
   | Type | **Standard persistent disk** |
   | Size | **10** GB |
   | **Delete disk** | ❌ **取消勾选**「When deleting instance（删除实例时删除磁盘）」 |

4. 回到 **Management（管理）** 或创建页主界面，确认无误。

## 2.4 创建并拿 IP

1. 点底部 **「CREATE」/「创建」**
2. 等 1–2 分钟，实例列表出现 **绿勾**
3. 点实例名 **`wenap-prod`**
4. 复制 **External IP**（例如 `34.xx.xx.xx`）→ 记事本
5. 菜单 **VPC network → IP addresses**（或实例页 **External IP** 下拉）：
   - 若类型是 **Ephemeral**，点 **RESERVE STATIC** → 保留为 **静态 IP**

## 2.5 （可选）Vertex 权限 — 用 Gemini API 密钥可跳过

用 **`GEMINI_API_KEY`** 时 **不必** 给 VM 加 Vertex 角色。

若将来走 Vertex：VM 详情里的服务账号 → **IAM** → Edit → 加 **Vertex AI User**。

✅ **完成标志**：VM 运行中，有静态 IP。

---

# 第 3 步：SSH 进 VM，挂盘并装 Docker（45 分钟）

1. 在 VM 列表，点 **`wenap-prod` 那一行的「SSH」** 按钮 → 浏览器打开终端。
2. 查数据盘设备名（通常是 `sdb`）：

```bash
lsblk
```

看到 `sdb` 约 10G、`sda` 是系统盘。

3. **仅首次**格式化并挂载（⚠️ 若盘里已有数据不要 mkfs）：

```bash
sudo mkfs.ext4 -F /dev/sdb
sudo mkdir -p /mnt/wenap-data
sudo mount /dev/sdb /mnt/wenap-data
echo '/dev/sdb /mnt/wenap-data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo chown -R $USER:$USER /mnt/wenap-data
```

4. 装 Docker：

```bash
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

5. **关闭 SSH 窗口再开一次 SSH**（让 docker 组生效）。

6. 克隆代码：

```bash
git clone https://github.com/gugu8283-cpu/Wenap.git /opt/wenap
cd /opt/wenap/stockai
```

（若仓库根就是 stockai，则 `cd /opt/wenap`。）

✅ **完成标志**：`ls /mnt/wenap-data` 可写；`docker --version` 有输出。

---

# 第 4 步：配置 .env 并部署（60 分钟）

## 4.1 创建 .env

在 VM 上：

```bash
cd /opt/wenap/stockai
cp .env.example .env
nano .env
```

**必须填**（把 `xxx` 换成你的真实值）：

```env
NODE_ENV=production
SERVE_DIST=1
TRUST_PROXY=1
PORT=3002
APP_PUBLIC_URL=https://wenap.app

SQLITE_PATH=/app/data/wenap.db
DATA_DIR=/app/data

OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_TIMEOUT_MS=0
OPENROUTER_POLICY_FALLBACK=1

GEMINI_API_KEY=在 https://aistudio.google.com/apikey 创建
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_POLICY_ENABLED=1

JWT_SECRET=至少32位随机
ADMIN_SECRET=强密码
ALPHA_VANTAGE_API_KEY=xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_PRO_PLUS=price_xxx
RESEND_API_KEY=re_xxx
MAIL_FROM=Wenap <noreply@wenap.app>
CRON_ENABLED=true
```

保存：`Ctrl+O` → Enter → `Ctrl+X`。

## 4.2 构建并启动

```bash
npm ci
npm install @google/generative-ai
npm run build
docker compose -f deploy/docker-compose.gce.yml up -d --build
```

等 3–10 分钟 build 完成。

## 4.3 验收

```bash
curl -s http://127.0.0.1:3002/health
```

应看到 JSON，且含：

- `"geminiApiConfigured": true`
- `"geminiPolicyEnabled": true`

浏览器（暂时用 IP 测）：`http://你的外部IP/health`  
若打不开：GCP → **VPC network → Firewall** → 建规则允许 **tcp:3002** 从你的 IP，或先配 Nginx（见下）。

## 4.4 （推荐）装 Caddy 反代 443

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
echo 'wenap.app {
  reverse_proxy 127.0.0.1:3002
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

（DNS 还没指过来前 Caddy 可能报错，**第 6 步切 DNS 后**再 reload。）

✅ **完成标志**：`/health` 正常；Docker `docker ps` 看到 wenap 容器 Running。

---

# 第 5 步：验证「数据不丢」+ Gemini API 调用（30 分钟）

## 5.1 数据持久化

1. 浏览器打开站点（IP 或域名）
2. **注册** 一个新邮箱账号 → **验证邮件**
3. 登录 → 对 **NVDA** 跑一次分析
4. SSH 执行：

```bash
docker compose -f /opt/wenap/stockai/deploy/docker-compose.gce.yml restart
```

5. 再登录 → **用户还在、历史还在** ✅

## 5.2 Gemini API 是否被调用

1. 再跑 1–2 次 **股票**（非 ETF）分析
2. SSH 看日志：

```bash
docker compose -f /opt/wenap/stockai/deploy/docker-compose.gce.yml logs --tail=100
```

找：`policy-reg via Gemini API (gemini/gemini-2.5-flash-lite)`

3. Admin：`https://wenap.app/admin` → Analysis logs → model 含 `gemini/`

✅ **完成标志**：重启后数据在；日志有 Gemini API。

---

# 第 6 步：Cloudflare DNS 切到 GCP（20 分钟）

1. 登录 **https://dash.cloudflare.com**
2. 点域名 **`wenap.app`**
3. 左侧 **DNS → Records**
4. 找到 **A 记录** `@` 或 `wenap.app`：
   - 点 **Edit**
   - **IPv4 address** 改成 GCE **静态 IP**
   - **Proxy status** 保持 **Proxied（橙色云）**
   - **Save**
5. 若有 `www` CNAME 到 `wenap.app`，保持不变
6. 等 2–10 分钟
7. 浏览器打开 **https://wenap.app/health** 确认
8. VM 上确认 `.env` 里 `APP_PUBLIC_URL=https://wenap.app`
9. **Stripe Dashboard** → Webhooks → 确认 endpoint 仍是 `https://wenap.app/.../stripe/webhook` 且 **成功**
10. Render 旧服务：**Suspend** 或删除（避免双活）

✅ **完成标志**：wenap.app 指向 GCP；Stripe webhook 绿。

---

# 第 7 步：GitHub 共享给评委（10 分钟）

1. 打开 **https://github.com/gugu8283-cpu/Wenap**
2. **Settings → Collaborators**（或 **Manage access**）
3. **Add people**：
   - `testing@devpost.com`
   - `judging@hacker.fund`
4. 权限 **Read**
5. 若仓库 Private，等对方 accept；Public 也可，但仍建议 invite。

✅ **完成标志**：两位评委邮箱已邀请。

---

# 第 8 步：宣传（第 4 天起，每 2–3 天一轮，持续）

**目的**：竞赛要 **真实用户 + 真实收入**；0 用户无法过 Business Viability。

## 8.1 准备素材（做一次）

1. 打开 **https://wenap.app/sample/NVDA** 截图（手机 + 桌面各 1 张）
2. 准备 3 句话：

   **英文**：  
   *Wenap — AI stock research in ~2 min. Free 5 reports/month. Not financial advice.*

   **日文**：  
   *Wenap — AIが個人投資家向けに銘柄レポートを約2分で生成。月5回無料。*

   **中文**：  
   *Wenap — 输入代码，AI 生成结构化投研报告，免费每月 5 次。*

3. 每条宣传 **必须带**：
   - 链接：`https://wenap.app` 或 `/sample/NVDA`
   - 免责：*Not investment advice / 非投资建议*

## 8.2 第 1 周宣传清单（按顺序发）

### Day A — X (Twitter)

1. 登录 **https://x.com**
2. 点 **Post**
3. 粘贴英文 + 链接 + 截图 → **Post**

### Day B — Reddit

1. 打开 **https://reddit.com/r/stocks** 或 **r/investing**
2. 读右侧 **Rules**（避免被删）
3. 点 **Create Post → Text**
4. 标题示例：*I built a free AI research report tool for retail investors — feedback welcome*
5. 正文：问题 + wenap.app/sample/NVDA + 免责 → **Post**

### Day C — note.com（日文）

1. 登录 **https://note.com**
2. 右上角 **投稿 → テキスト**
3. 标题：*個人投資家向けAIレポートを作った*
4. 正文 + 截图 + wenap.app → **公開**

### Day D — 再发 X（日文或中文）

换语言再发一轮。

## 8.3 记录表（Google Sheet 或记事本）

每发一次记一行：

| 日期 | 渠道 | 链接 | 花费 $ | 注册数 | 备注 |

**Marketing spend 竞赛要披露**，哪怕 **$0** 也要记。

## 8.4 第 2 周起

- 发 **用户反馈**（有人用后再发）
- 提 **Pro $9.99** 无限次
- 在 **Indie Hackers**、**Hacker News Show HN**（英文）各发 1 次

**目标（8/17 前）**：

| 指标 | 最低 |
|------|------|
| Verified 注册用户 | 10+ |
| 付费用户（非你本人） | 3+ |
| 竞赛期 arms-length 收入 | $100+ |
| 书面 testimonial + 授权联系方式 | 2+ |

## 8.5 向用户要 testimonial（模板）

用户用过之后发消息：

> Thanks for trying Wenap! I'm entering the Build with Gemini XPRIZE. May I quote your feedback (first name + email) in my submission? Reply YES if OK.

记下：**姓名、邮箱、原话、是否付费**。

---

# 第 9 步：竞赛合规最终核对（7 月中做一次）

打印勾选：

```
□ Devpost 已注册
□ 生产在 Google Cloud（GCE，不是 Render）
□ 持久盘：重启/ redeploy 后 wenap.db 仍在
□ Gemini API：/health 为 true；analysis_logs 有 gemini/
□ OpenRouter 主分析仍可用
□ GitHub 已 invite testing@devpost.com + judging@hacker.fund
□ 5/19–8/17 有 verified 用户（非仅自己）
□ 有第三方 Stripe 收入（非 related-party 单独列）
□ Marketing spend 有记录（可为 0）
```

---

# 第 10 步：录 3 分钟演示视频（8 月初）

**要求**：YouTube 或 Vimeo **公开**；展示 AI 在生产中运行。

## 10.1 脚本（按这个录）

1. **0:00–0:20** 打开 wenap.app，说 Problem：*Retail investors lack affordable research*
2. **0:20–0:50** 注册 / 登录
3. **0:50–2:00** 输入 NVDA → 分析 → 展示报告（分数、雷达、情景）
4. **2:00–2:30** Admin 或日志：*This policy dimension uses Google Vertex Gemini in production*
5. **2:30–2:50** Pricing / Stripe 付费页（有真实用户更好）
6. **2:50–3:00** *Built on Google Cloud. Not investment advice.*

## 10.2 上传

1. 登录 **https://youtube.com**
2. **Create → Upload video**
3. 标题：`Wenap — AI Financial Access on Google Cloud + Vertex Gemini`
4. 可见性：**Public**
5. 复制链接备用

---

# 第 11 步：准备提交材料（8/10–8/16）

## 11.1 英文叙事（500–1000 words，Devpost 用）

结构：

1. **Problem** — 个人投资者信息门槛  
2. **Solution** — Wenap + Financial Access  
3. **AI-native** — OpenRouter 主报告；Vertex Gemini 政策维；CRON 样本分析  
4. **Human vs AI** — 你做什么 vs 模型做什么  
5. **Traction** — 用户数、收入、testimonial  
6. **Built May 19+** — 5/19 后 launch / Gemini-native 模块（如实写 Git 时间线）

## 11.2 财务证据

1. **Stripe Dashboard** → Payments → Export **May–Aug 2026** CSV  
2. 截图 **Total revenue** 按竞赛期  
3. **Related-party**（若自己/test 账号付过费）**单独一页**说明  
4. GCP **Billing** 截图：hosting + Vertex 成本  
5. **Marketing spend** 汇总（可为 $0）

## 11.3 Product evidence

- Admin **Analysis logs** 截图（含 `vertex/`）  
- GCP **Logging** 或 Docker logs 截图  
- `/health` JSON 截图  

## 11.4 Customer evidence

- 用户总数、verified 数  
- 2+ testimonial（经同意）  
- 客户联系方式列表（姓名、email；竞赛可能抽查）

---

# 第 12 步：Devpost 正式提交（8/17 前，13:00 PDT）

1. 打开 **https://xprize.devpost.com/**
2. 登录 → 你的项目 → **Enter a Submission** 或 **Submit**
3. 逐项填：

   | 字段 | 填什么 |
   |------|--------|
   | Project name | Wenap |
   | Category | Money & Financial Access |
   | Website | https://wenap.app |
   | GitHub | 仓库 URL（已 shared 给评委） |
   | Video | YouTube 公开链接 |
   | Description | 第 11 步英文叙事 |
   | Revenue evidence | 上传 Stripe 导出 / 截图 |
   | Expenses | hosting + OpenRouter + marketing |
   | Testing instructions | 给评委测试账号 email/password；说明免费 5 次/月 |

4. **Save** → 检查预览 → **Submit**（截止前可改 draft，截止后不能改）
5. 确认收到 Devpost 确认邮件

✅ **完成标志**：Submission 状态 **Submitted**。

---

# 附录 A：最低环境变量速查

见 `docs/GCP-全迁方案.md` 第 6 节 + `.env.example`。

---

# 附录 B：出问题找哪一步

| 现象 | 回到哪步 |
|------|----------|
| geminiPolicyEnabled false | 第 4 步 `.env` 是否填 `GEMINI_API_KEY` |
| 数据丢了 | 第 2–3 步持久盘；compose volume |
| wenap.app 打不开 | 第 6 步 DNS |
| 0 用户 | 第 8 步宣传 |
| Stripe 没收入 | 第 8 步 + Pricing 页 |

---

# 附录 C：若暂时不想全迁 GCP（备选）

只做 **Render Starter + 挂盘 + Vertex** 也可参赛，顺序替换为：

1. Devpost 注册（第 0 步不变）  
2. GCP 只开项目 + Vertex API + **Service Account JSON**  
3. Render 升 Starter → Disk `/var/data` → `SQLITE_PATH=/var/data/wenap.db`  
4. Render 环境变量加 `GCP_PROJECT_ID`、`VERTEX_LOCATION`、**`GOOGLE_APPLICATION_CREDENTIALS_JSON`**  
5. 第 8–12 步宣传与提交 **相同**

详见此前对话「方案 B」；全迁细节见 `docs/GCP-全迁方案.md`。

---

*文档版本：2026-05-29 · 与 `GCP-全迁方案.md`、代码 `lib/geminiApiClient.cjs` 配套使用*
