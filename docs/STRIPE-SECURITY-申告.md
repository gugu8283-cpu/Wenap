# Stripe 日本セキュリティ申告 — Wenap 填写对照

提交前在 **Render → Environment** 设置（生产）：

```env
ADMIN_IP_ALLOWLIST=你的公网IP
ADMIN_PIN=另设6位以上PIN（勿与ADMIN_SECRET相同）
TRUST_PROXY=1
```

部署后从该 IP 打开 `https://wenap.app/admin`，输入 **ADMIN_SECRET + ADMIN_PIN**。

每季度本地执行一次：`npm audit`（留存终端输出备查）→ 第 3 节「脆弱性診断」可答 **はい**。

---

## 上半部分

| 项目 | 选择 |
|------|------|
| 決済方法 | **その他**（Stripe Checkout） |
| オンライン販売 | **はい** |
| 委託先 | **従業員** |

---

## 1. 管理者画面 — 三项均须 **はい**（配置上述 env 后）

| 子项 | 选择 |
|------|------|
| IP 限制或 Basic 认证 | **はい**（`ADMIN_IP_ALLOWLIST`） |
| 二段階認証 | **はい**（`ADMIN_SECRET` + `ADMIN_PIN`） |
| 10 次失败锁定 | **はい**（错误 Token/PIN 10 次锁定 30 分） |

---

## 2. 目录暴露 — 两项 **はい**

---

## 3. 脆弱性

| 子项 | 选择 |
|------|------|
| 定期脆弱性诊断/渗透测试 | **はい**（季度 `npm audit` + 依赖更新，保留记录） |
| SQLi / XSS 对策 | **はい** |
| 安全编码 / 输入校验 | **はい** |

---

## 4. 防病毒 — **はい**（开发 PC 杀毒软件）

---

## 5. 试卡对策 — 父项 **はい**（Stripe Checkout + 3DS + 自动试卡限制）

---

## 6. 不正ログイン — 勾选以下（勿选「会員ログインなし」）

- [x] ユーザー登録、ログイン、アカウント変更の対策  
- [x] 不審な IP アドレスからのアクセス制限（注册 IP 限制）  
- [x] ユーザー登録時の個人情報の確認（邮箱验证）  
- [x] ログイン試行回数の制限（`LOGIN_LOCKOUT_MAX`）  
- [x] アカウント情報変更時のメール通知（密码重置邮件）  
- [x] デバイスフィンガープリント（Render 设 `WENAP_DEVICE_FINGERPRINT=1` 时勾选）  

不勾选：二段階認証（用户端尚未上线）、行動分析、SMS 登录通知。

---

## 公网 IP 查询

浏览器打开 https://ifconfig.me 或 Cloudflare Dashboard 当前 IP → 填入 `ADMIN_IP_ALLOWLIST`。

---

**版本**：2026-05-21 · https://wenap.app
