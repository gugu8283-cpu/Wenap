# Wenap 上线行动基准（只走 Render）

**原则**：省事优先；不迁 Vultr；做大了也留在 Render 升配。

---

## 三阶段（按收入切换）

| 阶段 | 条件 | Render | 数据 | 你要做的 |
|------|------|--------|------|----------|
| **① 内测** | 现在 | **Free** | 可丢；少点 Deploy | 按下面「内测 10 步」 |
| **② 有收入** | 第一笔订阅或要认真留数据 | **Starter + 1GB 磁盘** | 部署一般不丢 | Dashboard 升级 + 加盘 |
| **③ 做大** | 月收入稳定 $3k+ 或分析变慢 | **Render 升 CPU/RAM** | 磁盘保留 + 偶尔备份 | 只点升级，不迁机 |

页脚/公测说明建议：

- ①：`内测环境，数据可能重置。`
- ②起：`数据持久保存（Render 托管）。`

---

## 内测：10 步上 Render（Free）

### 准备（本机做一次）

1. 代码推到 **GitHub**（仓库根目录 = 本 `stockai` 项目）。
2. 本机生成三个秘密（记下来）：
   ```powershell
   # PowerShell 各执行一次，复制输出
   [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
   ```
   用作 `JWT_SECRET`、`ADMIN_SECRET`（各 32 位以上即可）。

### Render 控制台

3. 打开 [render.com](https://render.com) → 登录 → **New +** → **Web Service**。
4. 连接 GitHub 仓库；**Root Directory** 若项目在子文件夹则填 `stockai`。
5. 填写：
   - **Name**：`wenap`（随意）
   - **Region**：**Singapore**
   - **Branch**：`main`
   - **Runtime**：Node
   - **Build Command**：`npm ci && npm rebuild better-sqlite3 && npm run build`
   - **Start Command**：`node server.cjs`
   - **Plan**：**Free**
6. **Environment** → Add：
   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `SERVE_DIST` | `1` |
   | `TRUST_PROXY` | `1` |
   | `OPENROUTER_API_KEY` | 你的 key |
   | `JWT_SECRET` | 上面生成的 |
   | `ADMIN_SECRET` | 上面生成的 |
   | `CRON_ENABLED` | `true` |
   | `APP_PUBLIC_URL` | 先留空，部署后改（见下） |
7. **Advanced** → **Health Check Path**：`/health`
8. **Create Web Service**，等 Build 绿勾（约 5–10 分钟）。
9. 打开 `https://wenap-xxxx.onrender.com`；到 **Environment** 把 `APP_PUBLIC_URL` 设为该 **https 地址** → Save（会触发一次 Deploy）。
10. 验收：`/health`、打开 `/admin` 出现登录页（输入 `ADMIN_SECRET`）、注册、跑一次分析。

**内测注意**：Free **不要频繁 Deploy**；要发新版时接受「可能清空用户数据」，或先进入阶段 ②。

---

## 有收入：升级到 Starter + 磁盘

1. 服务页 → **Settings** → **Instance Type** → **Starter**（或更高）。
2. **Disks** → **Add Disk**：
   - Mount Path：`/var/data`
   - Size：1 GB
3. **Environment** 增加/修改：
   - `SQLITE_PATH` = `/var/data/wenap.db`
4. **Manual Deploy** 一次。
5. 以后 Deploy **一般不会丢** 用户与分析记录。

---

## 做大：继续 Render

- **Settings** 里升 CPU / RAM。
- SQLite 不够时：Render **PostgreSQL** + 改代码（以后再做）。
- OpenRouter 设 **月度预算上限**（比迁 VPS 更重要）。
- **不迁 Vultr**，除非某天你又想折腾且账单真的刺痛你。

---

## 收入 / 用户粗算（心里有数即可）

| 月收入约 | 建议档位 |
|----------|----------|
| $0 | Free |
| $1+ 或要认真留数据 | Starter + 盘（~$8–12/月） |
| $3k+ | Render 升配 |
| $1万+ | 仍 Render；差 $20/月 不值得迁 VPS |

API 费用通常 **大于** 服务器差价。

---

## 测试账号（线上无需 Shell）

Render **Free 没有 Shell**，用环境变量在启动时自动创建：

1. Dashboard → **Environment** → 添加 `SEED_TEST_ACCOUNTS` = `1`
2. **Manual Deploy** 或等自动部署完成
3. 在 **Logs** 里确认出现：`测试账号已就绪`
4. 登录成功后可将该变量删掉（避免每次重启都刷日志；账号会留在库里直到 Free 盘被清空）

本机也可：`npm run create-test-accounts`

| 档位 | 邮箱 | 密码 |
|------|------|------|
| 免费 | `free@wenap.test` | `Wenap2026Free!` |
| Pro | `pro@wenap.test` | `Wenap2026Pro!` |
| Pro+ | `proplus@wenap.test` | `Wenap2026ProPlus!` |

内测结束后请关闭 `SEED_TEST_ACCOUNTS` 并考虑改测试密码。

**若分析时报「账号无效」或「登录已失效」**：多为 Render 重新部署后数据库清空，但浏览器仍保留旧令牌。请 **退出登录 → 再登入一次**（或清除本站数据后重登）。

## 常用命令

```bash
# 本机打包 data 备份（Deploy 前，尤其 Free 档）
npm run backup:data
```

---

## 相关文件

- 详细说明：[DEPLOY-RENDER.md](./DEPLOY-RENDER.md)
- Blueprint（可选，默认 Free）：根目录 `render.yaml`
- 备用（不必看）：[DEPLOY-VULTR.md](./DEPLOY-VULTR.md)
