# Wenap · 发给创作者的资料包

> **用途**：对方同意合作或要素材时，从对应语言文件夹里打包发送（邮件附件 / 网盘 / DM 文件）。  
> **不含**：推广链接 `?via=`（在 Rewardful Invite 后单独发，见 `../Wenap-Outreach-Drafts/follow-up-link-dm-*.txt`）

---

## 文件夹

| 文件夹 | 发给谁 |
|--------|--------|
| **`en/`** | Sheet 语言 = EN 的创作者（#1–9、#16–20、#23–25） |
| **`zh/`** | Sheet 语言 = ZH 的创作者（#10–15、#21–22） |

Logo 与产品截图界面语言无关，**两套各有一份**，方便你只打开一个文件夹就能发全。

---

## 每套里有什么

| 文件 | 说明 |
|------|------|
| `one-pager.pdf` | 一页纸介绍（产品 + 分佣 + Wise 付款） |
| `one-pager.html` | PDF 源文件（需更新时可浏览器打印重导） |
| `affiliate-terms.txt` | 佣金条款全文（对方问细节时转发） |
| `demo.mp4` | 界面录屏（EN 或 ZH UI） |
| `logo.svg` / `logo.png` | 品牌 Logo |
| `shot-hero.png` | 样本页截图：总分 / 顶部 |
| `shot-radar.png` | 雷达图 |
| `shot-scenarios.png` | 情景分析 |
| `00-SEND-CHECKLIST.txt` / `00-发送清单.txt` | 你该附哪些、披露要求 |
| `data-sources.txt` | 数据来源说明（测评 / 对方提问时） |

---

## 怎么发

### 邮件（推荐附全套）

1. 打开 `en/` 或 `zh/`
2. 附件：`one-pager.pdf` + 3 张 `shot-*.png` + `logo.png`（demo 大文件可写「网盘另发」）
3. 正文里给 `https://wenap.app/sample/NVDA` + 已 Invite 的 `?via=` 链接

### 私信 / DM

- 第一条通常**不附**大文件
- 对方要素材时：发 `one-pager.pdf` + 一句「demo on request」，或打包整个语言文件夹上传

### 更新素材

源文件维护在 `../Wenap-Affiliate-Kit/`。更新后重新复制到本目录，或运行：

```powershell
cd "c:\Users\Yap Wei Jun\Downloads\app開発\stockai"
node scripts/sync-creator-materials.mjs
```

---

## 源目录

`docs/Wenap-Affiliate-Kit/` — 生成/维护素材的工作区  
`docs/Wenap-Outreach-Drafts/` — 私信文案（不是资料包）
