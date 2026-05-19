# Wenap（可上架发行说明）

联网生成结构化投研报告（SSE 流式输出）、六维评分、自选与历史、免费月度额度与 Pro/Pro+ 档位。**本仓库可按「单进程 + 静态前端」或 Docker 部署上架。**

## 快速开始（开发）

1. 复制环境变量模板：将 `.env.example` 复制为 `.env`，填写 `OPENROUTER_API_KEY`（必填）。
2. `npm ci`
3. 同时起前后端：`npm run dev:full`（Vite `5173` 代理 `/api` → 本服务 `3002`）  
   或分终端：`npm run server` + `npm run dev`

## 生产上架（推荐）

### 形态说明

- 执行 `npm run build` 生成 `dist/`。
- 设置 **`NODE_ENV=production`**（或 **`SERVE_DIST=1`**）启动 `node server.cjs` 时：
  - 托管 `dist/` 静态资源；
  - 浏览器请求 **`/api/...`** 会在服务端剥离前缀后进入现有路由（与开发时 Vite 代理行为一致）；
  - 探活与健康信息在 **`GET /health`**（JSON），勿与 SPA 根路径混淆。

### 命令示例

```bash
npm ci
npm run build
NODE_ENV=production PORT=3002 node server.cjs
```

Windows PowerShell：

```powershell
$env:NODE_ENV="production"; $env:PORT="3002"; node server.cjs
```

### 环境变量（摘要）

| 变量 | 说明 |
|------|------|
| `OPENROUTER_API_KEY` | OpenRouter 密钥（必填） |
| `ALPHA_VANTAGE_API_KEY` | 可选，行情 OVERVIEW / 报价货币 |
| `PORT` | 监听端口，默认 `3002` |
| `NODE_ENV=production` | 启用 `dist` 托管 + `/api` 前缀剥离 |
| `SERVE_DIST=1` | 不设置 `NODE_ENV` 时也可强制 SPA 模式 |
| `CORS_ORIGIN` | 前后端分离时填写来源，逗号分隔；同源部署可留空 |
| `TRUST_PROXY=1` | 反代后识别 HTTPS / 客户端 IP |
| `VITE_SUBSCRIBE_URL` | 前端构建时写入，结账链接（可选） |
| `VITE_BASE_PATH` | 子路径部署时与 Vite `base` 一致（可选） |

完整说明见 **`.env.example`**。

### Docker

```bash
docker build -t wenap:1.0.0 .
docker run --rm -p 3002:3002 --env-file .env wenap:1.0.0
```

镜像内已 `npm run build`，默认 `NODE_ENV=production`。

### 上线（Render，行动基准）

**只走 Render、省事优先；不迁 Vultr。**

| 阶段 | 做法 |
|------|------|
| 内测 | Render **Free** |
| 有收入 | **Starter + 磁盘** |
| 做大 | Render **升配** |

👉 按步骤做：**[docs/RENDER-行动基准.md](docs/RENDER-行动基准.md)**（内测 10 步清单）  
补充说明：[docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md)

### Vultr（备用，不必看）

见 [docs/DEPLOY-VULTR.md](docs/DEPLOY-VULTR.md)。

### 反向代理（Nginx 示例）

```nginx
location / {
  proxy_pass http://127.0.0.1:3002;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

云上托管请将 **`TRUST_PROXY=1`** 打开，以便限流与日志使用真实客户端 IP（若后续启用）。

## 计费与套餐（当前实现）

- **免费**：每月固定次数（见服务端 `FREE_MONTHLY_ANALYSIS_CAP`），需传 **`anonId`** 或 **`userId`** 计次；前端已生成并附带 `anonId`。
- **Pro / Pro+**：由请求体 `tier` 与本地 `localStorage.wenap_tier` 控制；**上架前请接入你自己的账号/支付系统**，勿仅依赖本地存储。

## 数据目录

运行时写入 `data/`（额度、自选、历史）。仓库内仅保留 `data/.gitkeep`；部署环境请挂载卷或备份该目录。

## 合规

页脚免责声明已提示「仅供参考、不构成投资建议」。上架应用商店或面向公众时，请再做法务审核与地域合规检查。

## 脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 仅前端 |
| `npm run server` | 仅 API（默认无 SPA，配合 Vite 代理） |
| `npm run dev:full` | 前后端开发 |
| `npm run build` | 生产构建 |
| `npm run start` | 运行 `server.cjs`（生产请配合 `NODE_ENV=production` 与已构建的 `dist`） |
| `npm run lint` | ESLint |

## 成本与毛利试算（运营）

- 开发模式（`npm run dev`）下，页底会显示 **「运营成本与毛利试算」** 折叠面板：默认按你这类 workload **单次约 $0.05（Flash 路径）** 做账单边际；可改「Pro+ 单次」、用量与固定成本，粗算**毛利**。
- 生产构建若也要显示：构建前设置 **`VITE_SHOW_ECONOMICS=1`**（勿对终端用户默认开启）。
- 默认单价为**占位**，必须用 OpenRouter / 云厂商**真实账单**回填后再做定价；未含支付手续费、税与人力。

## 降本（代码已支持，默认不伤体验）

- **Alpha Vantage**：同一标的 **`ALPHA_VANTAGE_CACHE_MS`**（默认 10 分钟）内复用 GLOBAL_QUOTE+OVERVIEW，少打 AV、少等 1.2s 间隔；设为 `0` 关闭缓存。  
- **OpenRouter**：主模型与领导人调用带 **`max_tokens`** 上限（`OPENROUTER_MAX_OUTPUT_TOKENS_MAIN` / `…_LEADER`），抑制偶发超长补全；默认 16384 / 3072，JSON 正常远小于此。  
- **客户端断开**：SSE 连接关闭后，在 AV / 主模型 / 领导人 / 流式正文前检测，**尽早中止**后续上游调用。

## 技术栈

React 19 + Vite 8，Express 5（`server.cjs` CommonJS），OpenRouter，可选 Alpha Vantage。
