# 部署到 Render（Wenap）

**行动基准（三阶段、只走 Render）** → 请先读 **[RENDER-行动基准.md](./RENDER-行动基准.md)**。

单服务托管：**前端 `dist/` + Express API + SQLite**，域名形如 `https://wenap.onrender.com`。

## 前提

- GitHub / GitLab 仓库已包含本项目（`stockai` 目录为根目录，或整个仓库即 stockai）
- [Render](https://render.com) 账号
- 已准备：`OPENROUTER_API_KEY`、随机 `JWT_SECRET`（≥32 位）、随机 `ADMIN_SECRET`（≥32 位）

## 方式 A：Blueprint（推荐）

1. Render → **New** → **Blueprint**
2. 连接仓库，Render 会读取根目录 `render.yaml`
3. 在创建向导里为 **Secret** 变量填值：
   - `OPENROUTER_API_KEY`
   - `JWT_SECRET`
   - `ADMIN_SECRET`
   - `APP_PUBLIC_URL` = `https://你的服务名.onrender.com`（先部署一次拿到 URL 再改也行）
4. 可选：`ALPHA_VANTAGE_API_KEY`、SMTP 相关（注册验证邮件）
5. 点击 **Apply**，等待 Build 完成（约 3–8 分钟）

## 方式 B：手动创建 Web Service

| 项 | 值 |
|----|-----|
| Environment | **Node** |
| Region | **Singapore**（离日本较近） |
| Branch | `main` |
| Root Directory | 若 monorepo 填 `stockai` |
| Build Command | `npm ci && npm rebuild better-sqlite3 && npm run build` |
| Start Command | `node server.cjs` |
| Health Check Path | `/health` |

**Environment Variables（必填）**

| 变量 | 示例 |
|------|------|
| `NODE_ENV` | `production` |
| `SERVE_DIST` | `1` |
| `TRUST_PROXY` | `1` |
| `OPENROUTER_API_KEY` | `sk-or-...` |
| `JWT_SECRET` | 随机 32+ 字符 |
| `ADMIN_SECRET` | 随机 32+ 字符 |
| `APP_PUBLIC_URL` | `https://xxx.onrender.com` |
| `SQLITE_PATH` | `/var/data/wenap.db` |
| `CRON_ENABLED` | `true` |

**Persistent Disk（强烈建议）**

- Mount path: `/var/data`
- Size: 1 GB  
- 与 `SQLITE_PATH=/var/data/wenap.db` 对应  

没有磁盘时，**每次重新部署可能清空数据库**（仅适合试玩）。

## 部署后检查

1. 打开 `https://你的域名.onrender.com` → 应看到 Wenap 首页  
2. `https://你的域名.onrender.com/health` → JSON `ok`  
3. 注册 / 登录 → 跑一次分析  
4. 管理后台 `https://你的域名.onrender.com/admin` → 用 `ADMIN_SECRET` 登录  

## 自定义域名（可选）

1. Render 服务 → **Settings** → **Custom Domains** → 添加域名  
2. 在 Cloudflare（或其它 DNS）添加 CNAME 指向 Render  
3. 把 `APP_PUBLIC_URL` 改成 `https://你的域名` → **Manual Deploy** 或改 env 后自动 redeploy  

## 费用与限制

| 档位 | 说明 |
|------|------|
| **Free** | 会休眠、**无持久磁盘**、cron 不稳定，不建议生产 |
| **Starter (~$7/月)** | 不休眠 + 可挂 Disk，适合正式上线 |

分析接口为 **SSE 长连接**，免费档冷启动后首请求可能较慢。

## 常见问题

**Build 失败 `better-sqlite3`**

- Build Command 必须包含：`npm rebuild better-sqlite3`
- `NODE_VERSION=20` 与本地开发尽量一致

**登录 / 注册邮件发不出**

- 配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`MAIL_FROM`
- 可用 [Resend](https://resend.com) SMTP

**502 / 服务起不来**

- Logs 里看是否缺 `OPENROUTER_API_KEY`
- 确认 `PORT` 未手动写死为 `3002`（Render 会注入自己的 `PORT`，代码已支持）

## 本地与 Render 环境对照

| 本地 | Render |
|------|--------|
| `npm run dev:full` | 不需要，单进程 `node server.cjs` |
| `http://localhost:5173` | `https://xxx.onrender.com` |
| `data/wenap.db` | `/var/data/wenap.db`（挂盘后） |
