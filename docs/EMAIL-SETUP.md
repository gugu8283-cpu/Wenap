# Wenap 邮箱验证（Resend）配置

注册后必须验证邮箱才能登录和使用分析。生产环境 **必须** 配置发信，否则注册会返回 `EMAIL_NOT_CONFIGURED`。

## 1. Resend 账号与域名

1. 打开 [Resend](https://resend.com) → **Domains** → Add **`wenap.app`**
2. 在 **Cloudflare**（`wenap.app` DNS）添加 Resend 提供的 **DKIM / SPF** 记录
3. 等待 Resend 显示域名 **Verified**

## 2. Render 环境变量

在 Render → Wenap 服务 → **Environment** 添加：

```env
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM=Wenap <noreply@wenap.app>
APP_PUBLIC_URL=https://wenap.app
```

| 变量 | 说明 |
|------|------|
| `RESEND_API_KEY` | Resend → API Keys → 创建（Sending access） |
| `MAIL_FROM` | 发件人，域名必须是已验证的 `wenap.app` |
| `APP_PUBLIC_URL` | 验证链接前缀，必须是 `https://wenap.app` |

可选（SMTP 代替 Resend）：

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=0
MAIL_FROM=noreply@wenap.app
```

## 3. 部署后验收

| 步骤 | 预期 |
|------|------|
| `GET https://wenap.app/api/auth/email-status` | `"configured": true`, `"transport": "resend"` |
| 注册新邮箱 | 收到「验证你的 Wenap 邮箱」邮件 |
| 点击邮件链接 | 打开 `/verify-email?token=...`，显示成功并进入 `/app` |
| 未验证时登录 | 提示先验证，可点「重新发送验证邮件」 |
| 未验证时访问 `/app` | 自动跳到验证页 |

## 4. 常见问题

- **收不到邮件**：查垃圾邮件；确认 Resend 域名 Verified；`MAIL_FROM` 使用 `@wenap.app`
- **链接点开无效**：链接 24 小时有效，过期后在验证页点「重新发送」
- **注册报邮件未配置**：Render 未设 `RESEND_API_KEY` 或未重新 Deploy
- **本地开发**：未配置时验证链接会打在 **服务器终端日志** 里（`[Wenap] 验证链接`）

## 5. 用户流程（已实现）

```
注册 → 发验证邮件 → /verify-email?email=...
     → 点邮件链接 → 自动登录 → /app
未验证登录 → 403 EMAIL_NOT_VERIFIED → 验证页重发
```

相关代码：`lib/emailSend.cjs`、`routes/auth.cjs`、`src/pages/auth/VerifyEmailPage.jsx`
