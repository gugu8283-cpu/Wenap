/**
 * Build printable HTML from docs/日本税务-Stripe与税理士指南.md
 * Open docs/wenap-tax-guide.html in Chrome → Print → Save as PDF
 */
const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '..', 'docs', '日本税务-Stripe与税理士指南.md');
const outHtml = path.join(__dirname, '..', 'docs', 'wenap-tax-guide.html');

const md = fs.readFileSync(mdPath, 'utf8');

function mdToHtml(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // tables
  const lines = html.split('\n');
  const out = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\|/.test(line)) {
      if (!inTable) {
        inTable = true;
        out.push('<table>');
      }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (/^[-:]+$/.test(cells.join(''))) continue;
      const tag = out[out.length - 1] === '<table>' ? 'th' : 'td';
      if (out[out.length - 1] === '<table>') {
        out.push('<tr>' + cells.map((c) => `<th>${c}</th>`).join('') + '</tr>');
      } else {
        out.push('<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>');
      }
      continue;
    }
    if (inTable) {
      out.push('</table>');
      inTable = false;
    }
    if (line.startsWith('<h') || line.startsWith('<blockquote')) {
      out.push(line);
    } else if (line.trim() === '---') {
      out.push('<hr/>');
    } else if (line.trim()) {
      out.push(`<p>${line}</p>`);
    }
  }
  if (inTable) out.push('</table>');
  return out.join('\n');
}

const body = mdToHtml(md);
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>Wenap 日本税务 · Stripe 与税理士指南</title>
<style>
@page { margin: 18mm; }
body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; max-width: 210mm; margin: 0 auto; padding: 12mm; line-height: 1.55; font-size: 10.5pt; color: #1a1a1a; }
h1 { font-size: 18pt; border-bottom: 2px solid #2d3a8c; padding-bottom: 8px; }
h2 { font-size: 13pt; color: #2d3a8c; margin-top: 1.4em; page-break-after: avoid; }
h3 { font-size: 11pt; margin-top: 1em; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5pt; page-break-inside: avoid; }
th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; }
th { background: #eef1fb; }
blockquote { background: #f5f6fa; border-left: 4px solid #6b7fd7; margin: 12px 0; padding: 8px 12px; font-size: 9.5pt; }
hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
p { margin: 0.4em 0; }
@media print { body { padding: 0; } }
</style>
</head>
<body>
${body}
<p style="margin-top:2em;font-size:9pt;color:#666;">生成日期：${new Date().toISOString().slice(0, 10)} · Wenap · https://wenap.app</p>
</body>
</html>`;

fs.writeFileSync(outHtml, page, 'utf8');
console.log('Wrote', outHtml);
console.log('Open in Chrome → Ctrl+P → 另存为 PDF → docs/wenap-tax-guide.pdf');
