# 部署到 Vultr（东京 VPS）

适合：你在日本、要 **SQLite 持久化**、**预测验证 cron 每天跑**、少依赖 PaaS 休眠规则。

推荐规格：**Cloud Compute · Tokyo · 2 GB RAM / 1 vCPU**（约 $12/月；1 GB 也能跑，构建时可能需加 swap）。

---

## 总览

```
用户浏览器 ──HTTPS──► 域名 (Cloudflare DNS 可选)
                        │
                   Caddy :443  (自动证书)
                        │
                   Docker :3002  (wenap 容器)
                        │
                   卷 wenap-data → SQLite + 历史 JSON
```

---

## 第一步：买 VPS

1. 注册 [Vultr](https://www.vultr.com/)
2. **Deploy** → **Cloud Compute**
3. **Location**: Tokyo (`NRT`)
4. **Image**: Ubuntu 24.04 LTS（或 22.04）
5. **Plan**: 2 GB RAM 推荐
6. **SSH Key**：建议添加（本机 `ssh-keygen` 后把公钥贴进去）
7. 创建后记下 **公网 IP**

本机连接：

```bash
ssh root@你的VPS_IP
```

---

## 第二步：服务器初始化（在 VPS 上执行）

```bash
apt update && apt upgrade -y
apt install -y git curl ca-certificates

# 安装 Docker（官方脚本）
curl -fsSL https://get.docker.com | sh
systemctl enable docker
```

防火墙（若启用 ufw）：

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

## 第三步：上传代码

**方式 A — Git（推荐）**

```bash
mkdir -p /opt/wenap && cd /opt/wenap
git clone https://github.com/你的用户名/你的仓库.git .
# 若仓库根目录不是 stockai，则：git clone ... repo && cd repo/stockai
```

**方式 B — 本机 rsync（无 Git 时）**

在**你电脑**上（PowerShell，改路径）：

```powershell
scp -r "c:\Users\Yap Wei Jun\Downloads\app開発\stockai\*" root@你的VPS_IP:/opt/wenap/
```

---

## 第四步：配置 `.env`

在 VPS 上：

```bash
cd /opt/wenap
cp .env.example .env
nano .env
```

**生产必填（示例）**：

```env
OPENROUTER_API_KEY=sk-or-...
JWT_SECRET=用 openssl rand -hex 32 生成
ADMIN_SECRET=用 openssl rand -hex 32 生成
APP_PUBLIC_URL=https://你的域名.com
NODE_ENV=production
SERVE_DIST=1
TRUST_PROXY=1
CRON_ENABLED=true
SQLITE_PATH=/app/data/wenap.db
PREDICTION_VERIFY_DAYS=30
```

生成随机密钥：

```bash
openssl rand -hex 32
```

可选：Alpha Vantage、SMTP（注册邮件）见 `.env.example`。

---

## 第五步：Docker 构建并启动

```bash
cd /opt/wenap
docker compose up -d --build
docker compose logs -f
```

看到 `Wenap listening on` 即成功。本机测：

```bash
curl -s http://127.0.0.1:3002/health
```

数据在 Docker 卷 **`wenap-data`**，重建容器不会丢库。

---

## 第六步：HTTPS（Caddy，最简单）

安装 Caddy：

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

复制项目里的 Caddy 配置（把域名改成你的）：

```bash
cp /opt/wenap/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile   # 改第一行域名
systemctl reload caddy
```

**DNS**：在 Cloudflare（或其它）添加 **A 记录** → 指向 VPS IP。  
若用 Cloudflare 代理（小橙云），Caddy 仍可申请证书；有问题可暂时「仅 DNS」灰云。

改完域名后，把 `.env` 里 `APP_PUBLIC_URL` 改成 `https://你的域名`，然后：

```bash
cd /opt/wenap && docker compose up -d
```

---

## 第七步：验收

| 检查 | 地址 |
|------|------|
| 首页 | `https://你的域名/` |
| 健康检查 | `https://你的域名/health` |
| 管理后台 | `https://你的域名/admin` |
| 公开准确率 | `https://你的域名/accuracy` |

注册 → 登录 → 跑一次分析；后台用 `ADMIN_SECRET` 登录。

---

## 日常运维

```bash
cd /opt/wenap

# 看日志
docker compose logs -f --tail=100

# 拉代码更新后重新部署
git pull
docker compose up -d --build

# 备份数据库
docker compose exec wenap sh -c 'cat /app/data/wenap.db' > ~/wenap-backup-$(date +%F).db
# 或备份整个卷：
docker run --rm -v wenap_wenap-data:/data -v $(pwd):/backup alpine tar czf /backup/wenap-data.tar.gz -C /data .
```

---

## 不用 Docker（可选）

```bash
cd /opt/wenap
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm ci && npm rebuild better-sqlite3 && npm run build
export NODE_ENV=production SERVE_DIST=1 TRUST_PROXY=1 PORT=3002
node server.cjs
```

建议用 **systemd** 托管进程，见 `deploy/wenap.service.example`。

---

## 常见问题

**构建时内存不足（Killed）**

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```

**分析 SSE 超时**

Nginx/Caddy 需允许长连接；项目内 `deploy/Caddyfile` 与 `deploy/nginx-wenap.conf` 已加大超时。

**邮件发不出**

配置 SMTP；可用 Resend：`smtp.resend.com`、端口 `587`。

**和 Render 的区别**

Vultr 磁盘持久、进程常驻，**cron 更稳**；自己要管系统更新与安全补丁。

---

## 费用粗算

| 项 | 约 |
|----|-----|
| Vultr 2GB 东京 | ~$12/月 |
| 域名 | ~$10–15/年 |
| OpenRouter API | 按用量 |
| Cloudflare | 免费档够用 |
