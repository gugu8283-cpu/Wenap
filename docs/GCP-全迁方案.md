# Wenap 全迁 GCP 方案（GCE + 持久盘 + Gemini API + OpenRouter）

> **目标**：满足 Build with Gemini XPRIZE（Google Cloud + Gemini API），**持久保存 SQLite**，**避免 RoboBlueprint 在 Azure Container Apps 上的超时/冷启动/Blob 慢写问题**。  
> **原则**：**GCE 常开虚拟机**，**不用 Cloud Run / Container Apps**；**本地持久盘**，**不用 Blob**；**OpenRouter 主分析 + Gemini API（AI Studio 密钥）合规链路并行**。

---

## 1. 和上次 Azure 问题的对照（本方案如何避开）

| RoboBlueprint 痛点 | 原因 | 本方案 |
|--------------------|------|--------|
| 生成到一半失败 | Container Apps **入口 HTTP 超时** | GCE 常开，**无平台请求时限**；Wenap 主分析 `OPENROUTER_TIMEOUT_MS=0` + SSE |
| 整体变慢 | 冷启动、缩容到 0 | VM **min=1 常开**，不 scale-to-zero |
| 存储慢/丢数据 | **Blob JSON** 远程读写 | **SQLite 在本地持久盘** `/mnt/wenap-data` |
| 架构复杂 | Vercel ↔ Azure ↔ 多 AI | **单 VM 单进程** + Cloudflare |
| 超长多阶段任务 | 2–15 分钟 + job 队列 | Wenap ~1–3 分钟，链路更短 |

**明确禁止（本方案不要做）**

- ❌ Cloud Run / Azure Container Apps / 任何 scale-to-zero 跑长 SSE 分析  
- ❌ Cloud Storage FUSE / Blob 存 SQLite  
- ❌ 仅 Render 无 GCP 产品（竞赛「Google Cloud」项偏弱；本方案用 **GCE + Gemini API**）

---

## 2. 目标架构

```
用户浏览器
    ↓
Cloudflare（wenap.app，HTTPS / CDN）
    ↓
GCE e2-small（asia-northeast1 东京，常开）
    ├── Docker: node server.cjs :3002
    └── 持久盘挂载 /mnt/wenap-data → 容器内 /app/data
            ├── wenap.db          ← SQLite（用户/订阅/analysis_logs）
            ├── history/
            ├── quotas.json
            └── watchlist.json

server.cjs 一次分析：
    ├── Alpha Vantage（行情，不变）
    ├── OpenRouter（主报告 / Pro+ hybrid / 批评家，不变）
    └── Gemini API（政策法规维补刀，竞赛合规）← lib/geminiApiClient.cjs
```

---

## 3. 推荐规格

| 项目 | 选择 | 理由 |
|------|------|------|
| 区域 | **asia-northeast1（东京）** | 离日本近；与 Vertex 同区 |
| 机器 | **e2-small**（2GB RAM，0.5 vCPU） | Wenap 吃 RAM 多于 CPU |
| 系统盘 | 10GB Ubuntu 22.04 | 装 Docker |
| **数据盘** | **10GB 标准持久盘**，挂 `/mnt/wenap-data` | **Delete disk = 否**（删 VM 也不删数据） |
| 网络 | 静态外部 IP + Cloudflare 代理 | 隐藏源 IP，免费 HTTPS |
| AI | OpenRouter + **Gemini API `gemini-2.5-flash-lite`** | 主分析 + 合规各一路 |

**月费粗算（试用后）**：VM+盘 ~$16/月 + Vertex 小流量 ~$1–5 + OpenRouter 另计。  
**前 90 天**：$300 试用可覆盖 VM + 盘 + 大部分 Vertex。

---

## 4. 代码已准备的改动

| 文件 | 作用 |
|------|------|
| `lib/geminiApiClient.cjs` | Gemini API 直连（`GEMINI_API_KEY`） |
| `lib/vertexGeminiClient.cjs` | 可选 Vertex 路径（需 aiplatform API） |
| `server.cjs` | 政策法规维补刀：**Gemini API → Vertex → OpenRouter** |
| `deploy/docker-compose.gce.yml` | 生产 compose：持久盘 + 环境变量 |
| `deploy/gce-bootstrap.sh` | VM 首次装 Docker 的脚本 |
| `.env.example` | `GEMINI_API_KEY`、`GEMINI_POLICY_ENABLED` 等 |

**竞赛合规调用点**：政策维补刀 → 生产环境 **至少 1 次 Gemini API 调用**（见 `analysis_logs.model` 含 `gemini/`）。

安装依赖（本地或 VM 一次）：

```bash
cd stockai
npm install @google/generative-ai
```

---

## 5. 迁移步骤（按顺序做）

### 阶段 A：GCP 账号与 API（约 30 分钟）

1. 打开 [cloud.google.com/free](https://cloud.google.com/free) → 创建项目，例如 `wenap-prod`。  
2. **Billing** → 绑定信用卡 → 确认 **$300 试用** 生效。  
3. **Billing → Budgets** → 设 $50 / $100 告警。  
4. **API 和服务 → 启用**：  
   - Compute Engine API  
   - Vertex AI API  
5. 记下 **项目 ID**（不是项目名）。

### 阶段 B：创建 GCE + 持久盘（约 20 分钟）

1. **Compute Engine → VM 实例 → 创建**  
   - 名称：`wenap-prod`  
   - 区域：**asia-northeast1**  
   - 机器：**e2-small**  
   - 操作系统：Ubuntu 22.04 LTS  
   - 引导磁盘：10GB  
   - **网络**：允许 HTTP/HTTPS 流量（或仅 80/443 防火墙规则）  
2. **同一页面 → 添加新磁盘**（或创建后挂载）：  
   - 类型：**标准持久盘**  
   - 大小：**10GB**  
   - **取消勾选「删除实例时删除磁盘」**  
3. 创建完成后：**修改 VM** → 将数据盘挂为 **`/mnt/wenap-data`**（若创建时未挂）。  
4. 分配 **静态外部 IP**（VM → 网络接口 → 外部 IP → 静态）。

### 阶段 C：VM 权限（Vertex 用 ADC）

1. VM 详情 → **服务账号** → 使用默认或专用 SA。  
2. **IAM** → 该 SA 添加角色：**Vertex AI User**（`roles/aiplatform.user`）。  
3. GCE 上 **不需要** 下载 JSON 密钥（比 Render 更简单）。

### 阶段 D：部署 Wenap（约 1 小时）

SSH 进 VM：

```bash
# 1. 格式化并挂载数据盘（仅首次；若已在控制台挂载并格式化可跳过）
sudo mkfs.ext4 -F /dev/sdb   # 设备名以 lsblk 为准，勿 blindly 用 sdb
sudo mkdir -p /mnt/wenap-data
sudo mount /dev/sdb /mnt/wenap-data
echo '/dev/sdb /mnt/wenap-data ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo chown -R $USER:$USER /mnt/wenap-data

# 2. Bootstrap
git clone https://github.com/gugu8283-cpu/Wenap.git /opt/wenap
cd /opt/wenap/stockai
cp .env.example .env
# 编辑 .env（见下方「环境变量清单」）

npm ci
npm install @google-cloud/vertexai
npm run build

# 3. 启动
docker compose -f deploy/docker-compose.gce.yml up -d --build

# 4. 验收
curl -s http://127.0.0.1:3002/health | jq .
```

**（推荐）** 前面只监听 `127.0.0.1:3002`，前面加 **Caddy 或 Nginx** 反代 443；或 Cloudflare **Flexible/Full** 指到 80/443。

### 阶段 E：Cloudflare DNS 切换

1. Cloudflare → `wenap.app` → **A 记录** → GCE **静态 IP**（代理开启 🟠）。  
2. `.env` 中 `APP_PUBLIC_URL=https://wenap.app`。  
3. Stripe Webhook URL 若已配置，确认仍指向 `https://wenap.app/...`。  
4. 浏览器：注册 → 分析 → Admin 看 `analysis_logs`。

### 阶段 F：验证「数据不丢」（必做）

```bash
# 1. 注册测试用户，跑一条分析
# 2. 重启容器
docker compose -f deploy/docker-compose.gce.yml restart
# 3. 再登录 → 用户与分析记录仍在 ✅

# 4. 重新 deploy（拉新代码 rebuild）
docker compose -f deploy/docker-compose.gce.yml up -d --build
# 5. 数据仍在 ✅
```

### 阶段 G：验证 Vertex（竞赛）

```bash
curl -s https://wenap.app/health
# 应含 "vertexGeminiConfigured": true, "vertexPolicyEnabled": true
```

对某标的分析，若触发政策维补刀，日志应出现：

`[Wenap] policy-reg via Vertex (vertex/gemini-2.5-flash-lite)`

Admin → Analysis logs → model 含 `vertex/`。

### 阶段 H：关 Render（确认 GCP 稳定 24–48h 后）

1. Render Dashboard → 暂停或删除旧服务（避免双写/双域名混乱）。  
2. 保留 Render 环境变量截图作备份。

---

## 6. 环境变量清单（生产 `.env`）

```env
# --- 核心 ---
NODE_ENV=production
SERVE_DIST=1
TRUST_PROXY=1
PORT=3002
APP_PUBLIC_URL=https://wenap.app

# --- 持久数据（GCE）---
SQLITE_PATH=/app/data/wenap.db
DATA_DIR=/app/data

# --- OpenRouter（主分析，保留）---
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_TIMEOUT_MS=0
OPENROUTER_POLICY_FALLBACK=1

# --- Vertex（竞赛 + 政策维补刀）---
GCP_PROJECT_ID=wenap-prod
VERTEX_LOCATION=asia-northeast1
VERTEX_GEMINI_MODEL=gemini-2.5-flash-lite
VERTEX_POLICY_ENABLED=1

# --- 其余保持与 Render 相同 ---
JWT_SECRET=...
ADMIN_SECRET=...
ALPHA_VANTAGE_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_PRO=...
STRIPE_PRICE_PRO_PLUS=...
RESEND_API_KEY=...
CRON_ENABLED=true
```

---

## 7. OpenRouter + Vertex 并行说明

| 链路 | 提供方 | 何时调用 |
|------|--------|----------|
| 主报告 JSON | OpenRouter | 每次分析 |
| Pro+ hybrid / 批评家 | OpenRouter | Pro+ |
| **政策法规维补刀** | **Vertex**（已配置时） | 主模型该维不足时 |
| 行情 | Alpha Vantage | 每次分析 |

- Vertex **无 OpenRouter 式中间商加价**，走 GCP 账单（可用 $300）。  
- Vertex 失败 → 日志警告，**保留主模型结果**，不拖垮整单分析。  
- 若要政策维仍走 OpenRouter：设 `VERTEX_POLICY_ENABLED=0`。

---

## 8. 运维节奏（避免「天天管服务器」）

| 频率 | 做什么 |
|------|--------|
| 每周 | 打开 wenap.app、`/health`、Admin 错误日志 |
| 每月 | GCP 账单、磁盘用量；`scp` 备份 `wenap.db` |
| 每 1–3 月 | `sudo apt update && sudo apt upgrade -y`，重启 VM |
| 发版 | `git pull && docker compose -f deploy/docker-compose.gce.yml up -d --build` |

**可选监控（免费）**

- UptimeRobot → `https://wenap.app/health`  
- GCP Budget alert → 已设  

**备份（每月一次）**

```bash
cp /mnt/wenap-data/wenap.db ~/backups/wenap-$(date +%Y%m%d).db
# 或 gsutil cp 到 Cloud Storage（另开几美分/月）
```

---

## 9. Build with Gemini XPRIZE 对照

| 要求 | 本方案 |
|------|--------|
| Google Cloud 产品 | ✅ GCE + 持久盘 |
| Gemini API 生产调用 | ✅ Vertex 政策维补刀 |
| 真实用户/收入 | 需自行宣传（与 hosting 无关） |
| Devpost + GitHub 共享 | 迁移后做 |
| AI-native 叙事 | OpenRouter 主分析 + Vertex 日志 + `analysis_logs` |

---

## 10. 故障排查

| 现象 | 检查 |
|------|------|
| `/health` 无 `vertexGeminiConfigured` | `GCP_PROJECT_ID`、`VERTEX_LOCATION`；VM SA 是否有 Vertex AI User |
| 政策维从不走 Vertex | 主模型维已达标则跳过；或 `VERTEX_POLICY_ENABLED=0` |
| 分析 SSE 中断 | 查 Cloudflare 100s 限制；Wenap 已流式 chunk，一般 OK |
| 重启后数据没了 | 盘是否挂 `/mnt/wenap-data`；compose volume 是否对上 |
| Vertex 403 | 启用 Vertex AI API；区域是否支持该模型 |

---

## 11. 回滚计划

若 GCP 出现不可接受问题（48h 内）：

1. Cloudflare DNS 指回 **Render** URL。  
2. Render 用 Starter + `/var/data` 持久盘（见 `docs/RENDER-行动基准.md`）。  
3. `.env` 设 `VERTEX_POLICY_ENABLED=0` 或保留 Vertex（Render 上需 **GCP 服务账号 JSON**）。  
4. 从 `/mnt/wenap-data/wenap.db` 拷贝数据库到 Render 盘（若需保留用户）。

---

## 12. 检查清单（打印勾选）

```
□ GCP 项目 + $300 试用 + 预算告警
□ e2-small + 10GB 持久盘（删除 VM 不删盘）
□ Vertex AI API 启用 + SA 角色 Vertex AI User
□ docker compose 跑通 /health
□ vertexGeminiConfigured: true
□ 分析触发 vertex/ 日志
□ 重启容器后数据仍在
□ Cloudflare 指新 IP
□ Stripe / Resend / Cron 正常
□ Devpost 注册
□ Render 已停用（避免双活）
```

---

*文档版本：2026-05-29 · 代码入口：`lib/vertexGeminiClient.cjs`、`deploy/docker-compose.gce.yml`*
