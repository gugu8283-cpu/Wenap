# Wenap 法律页面说明

> **重要**：站内《隐私政策》《服务条款》《投资免责声明》为运营模板，便于上线与商店审核，**不构成法律意见**。收入稳定后建议由日本税理士/律师根据实际业务审阅修订。

## 公开 URL（部署 wenap.app 后）

| 页面 | URL |
|------|-----|
| 投资免责声明 | https://wenap.app/disclaimer |
| 隐私政策 | https://wenap.app/privacy |
| 服务条款 | https://wenap.app/terms |

## 站内链接位置

- 首页 / 应用页脚（短免责声明 + 三链接 + support 邮箱）
- 注册页：须勾选同意《服务条款》与《隐私政策》
- 登录 / 验证邮箱 / 忘记密码 / 定价 / 设置 / 准确率 / About

## 联系邮箱

条款与隐私中统一：`support@wenap.app`（建议在 Cloudflare Email Routing 转发到你的邮箱）

## 代码位置

- 文案：`src/i18n/locales/legal-*.json`
- 页面：`src/pages/legal/LegalPage.jsx`
- 页脚组件：`src/components/LegalFooter.jsx`

## 更新日期

修改文案后请同步更新各语言 JSON 中的 `updated` 字段。
