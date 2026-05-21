# wenap.app 域名上线清单

生产主域：**https://wenap.app**（`www` 可选，建议 301 到根域）

---

## 1. DNS（Cloudflare，域名已购买）

1. Cloudflare → **wenap.app** → **DNS** → **Records**
2. Render → 服务 **wenap** → **Settings** → **Custom Domains** → 添加 `wenap.app`
3. 复制 Render 显示的 CNAME 目标（形如 `xxxx.onrender.com`）
4. 在 Cloudflare 添加：

| 类型 | 名称 | 内容 | 代理 |
|------|------|------|------|
| CNAME | `@` | `xxxx.onrender.com` | 先 **DNS only**（灰云） |
| CNAME | `www` | 同上（可选） | 灰云 |

5. 等 Render 显示 **Verified** + HTTPS（约 5–30 分钟）

---

## 2. Render 环境变量

```env
APP_PUBLIC_URL=https://wenap.app
TRUST_PROXY=1
```

Save → 自动 Deploy。

---

## 3. www 重定向（可选）

Cloudflare → **Rules** → **Redirect Rules**：

- `www.wenap.app` → `https://wenap.app${uri}`，301

---

## 4. 邮件（Resend）

1. Resend → **Domains** → Add **wenap.app**
2. Cloudflare DNS 添加 Resend 的 DKIM / SPF
3. Render：

```env
RESEND_API_KEY=re_...
MAIL_FROM=Wenap <noreply@wenap.app>
```

4. Cloudflare **Email Routing**：`support@wenap.app` → 转发到你的 Gmail

---

## 5. Stripe

Webhook：`https://wenap.app/api/billing/webhook`

---

## 6. 验收

| URL | 预期 |
|-----|------|
| https://wenap.app | 首页 |
| https://wenap.app/health | ok |
| 注册邮件链接 | 域名为 wenap.app |

---

## 7. App Store / Play Store

商店必填链接（上线前在站点提供页面）：

- `https://wenap.app/privacy`
- `https://wenap.app/terms`
- `support@wenap.app`

详见产品路线图；`.app` 与移动应用品牌一致。
