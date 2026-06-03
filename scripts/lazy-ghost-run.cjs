/**
 * 懒惰鬼 — 线上 API 代测 + 报告导出
 * Usage: node scripts/lazy-ghost-run.cjs [--base https://wenap.app] [--out docs/lazy-ghost-output]
 */
const fs = require('fs');
const path = require('path');

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'https://wenap.app';
const OUT_DIR = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : path.join(__dirname, '..', 'docs', 'lazy-ghost-output');

const ACCOUNTS = {
  pro: { email: 'pro@wenap.test', password: 'Wenap2026Pro!' },
  pro_plus: { email: 'proplus@wenap.test', password: 'Wenap2026ProPlus!' },
};

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

function countCjk(text) {
  const m = String(text || '').match(CJK_RE);
  return m ? m.length : 0;
}

function collectText(obj, parts = []) {
  if (obj == null) return parts;
  if (typeof obj === 'string') {
    if (obj.trim()) parts.push(obj.trim());
    return parts;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) collectText(x, parts);
    return parts;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) collectText(v, parts);
  }
  return parts;
}

async function apiJson(method, urlPath, { token, body, headers: extraHeaders } = {}) {
  const headers = { Accept: 'application/json', ...extraHeaders };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  return { status: res.status, json, ok: res.ok };
}

async function login(tier = 'pro_plus') {
  const cred = ACCOUNTS[tier];
  const r = await apiJson('POST', '/auth/login', { body: cred });
  if (!r.ok) throw new Error(`login ${tier} failed ${r.status}: ${JSON.stringify(r.json)}`);
  return r.json.token;
}

async function consumeAnalyzeStream(token, body, timeoutMs = 360000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`analyze HTTP ${res.status}: ${errText.slice(0, 400)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let sseBuf = '';
    let vizSnapshot = null;
    let meta = null;
    let errMsg = '';

    function consumeBlock(block) {
      for (const line of block.split('\n')) {
        const L = line.trim();
        if (!L.startsWith('data:')) continue;
        let data;
        try {
          data = JSON.parse(L.slice(5).trim());
        } catch {
          continue;
        }
        if (data.type === 'meta') meta = data;
        if (data.type === 'viz' && data.snapshot) vizSnapshot = data.snapshot;
        if (data.type === 'data_warning') errMsg = data.message || errMsg;
        if (data.type === 'error') errMsg = data.message || data.code || 'error';
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuf += dec.decode(value, { stream: true });
      const blocks = sseBuf.split('\n\n');
      sseBuf = blocks.pop() || '';
      for (const block of blocks) consumeBlock(block);
    }
    if (sseBuf.trim()) consumeBlock(sseBuf);
    if (errMsg && !vizSnapshot) throw new Error(errMsg);
    if (!vizSnapshot) throw new Error('No viz snapshot in stream');
    return { vizSnapshot, meta, warning: errMsg || null };
  } finally {
    clearTimeout(t);
  }
}

function snapshotToMarkdown(label, { vizSnapshot, meta, warning }) {
  const s = vizSnapshot;
  const lines = [];
  lines.push(`# ${label}`);
  lines.push('');
  lines.push(`- **Ticker:** ${meta?.ticker || '—'}`);
  lines.push(`- **Locale:** ${meta?.locale || '—'}`);
  lines.push(`- **Tier / model:** ${meta?.tier || '—'} / ${meta?.model || '—'}`);
  lines.push(`- **Signal / score:** ${s.signal || '—'} / ${s.score ?? '—'}`);
  lines.push(`- **Started:** ${meta?.startedAt || '—'}`);
  if (warning) lines.push(`- **Warning:** ${warning}`);
  lines.push('');

  if (s.companyName || s.identityCheck) {
    lines.push(`## Identity`);
    if (s.companyName) lines.push(`**${s.companyName}**`);
    if (s.identityCheck) lines.push(s.identityCheck);
    lines.push('');
  }

  if (s.coreConclusion) {
    lines.push(`## Core conclusion`);
    const c = s.coreConclusion;
    if (c.headline) lines.push(`### ${c.headline}`);
    if (c.ifBull) lines.push(`**Bull:** ${c.ifBull}`);
    if (c.ifBear) lines.push(`**Bear:** ${c.ifBear}`);
    if (c.action) lines.push(`**Action:** ${c.action}`);
    lines.push('');
  }

  if (s.summary) {
    lines.push(`## Summary`);
    lines.push(s.summary);
    lines.push('');
  }

  if (Array.isArray(s.dimensions) && s.dimensions.length) {
    lines.push(`## Dimensions`);
    for (const d of s.dimensions) {
      const score = d.score ?? d.value ?? '—';
      lines.push(`- **${d.name}:** ${score}${d.note ? ` — ${d.note}` : ''}`);
    }
    lines.push('');
  }

  if (s.actionLine || s.actionLineObj) {
    lines.push(`## Action line`);
    if (s.actionLine) lines.push(s.actionLine);
    const al = s.actionLineObj || {};
    if (al.suggestion) lines.push(`- Suggestion: ${al.suggestion}`);
    if (al.stopLoss) lines.push(`- Stop: ${al.stopLoss}`);
    if (al.catalyst) lines.push(`- Catalyst: ${al.catalyst}`);
    lines.push('');
  }

  if (s.detailAnalysisFull) {
    lines.push(`## Detail analysis`);
    lines.push(s.detailAnalysisFull);
    lines.push('');
  }

  if (s.marketEnrichment) {
    lines.push(`## Market enrichment`);
    if (typeof s.marketEnrichment === 'string') lines.push(s.marketEnrichment);
    else if (s.marketEnrichment.text) lines.push(s.marketEnrichment.text);
    else lines.push('```json\n' + JSON.stringify(s.marketEnrichment, null, 2) + '\n```');
    lines.push('');
  }

  if (s.technicalSnapshot) {
    lines.push(`## Technical snapshot`);
    lines.push(s.technicalSnapshot);
    lines.push('');
  }

  return lines.join('\n');
}

function localeCheck(locale, vizSnapshot) {
  const text = collectText(vizSnapshot).join('\n');
  const cjk = countCjk(text);
  const issues = [];
  if (locale === 'en' && cjk >= 8) {
    issues.push(`EN report has ${cjk} CJK chars (possible zh leak)`);
  }
  if (locale === 'ja') {
    const hiragana = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    if (hiragana < 20 && cjk > 50) {
      issues.push(`JA report may be mostly Chinese (${cjk} CJK, ${hiragana} kana)`);
    }
  }
  return { cjk, textLen: text.length, issues };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = { base: BASE, at: new Date().toISOString(), checks: [], analyses: [], errors: [] };

  console.log(`[lazy-ghost] base=${BASE} out=${OUT_DIR}`);

  // Health
  const health = await apiJson('GET', '/health');
  report.checks.push({ name: 'health', status: health.status, ok: health.ok, body: health.json });
  console.log('[lazy-ghost] health', health.status, health.json?.cacheBackend);

  // Login pro + pro+
  let proToken;
  let proPlusToken;
  try {
    proToken = await login('pro');
    report.checks.push({ name: 'login_pro', ok: true });
    console.log('[lazy-ghost] login pro OK');
  } catch (e) {
    report.errors.push({ step: 'login_pro', message: e.message });
    console.warn('[lazy-ghost] login pro FAIL', e.message);
  }
  try {
    proPlusToken = await login('pro_plus');
    report.checks.push({ name: 'login_pro_plus', ok: true });
    console.log('[lazy-ghost] login pro+ OK');
  } catch (e) {
    report.errors.push({ step: 'login_pro_plus', message: e.message });
    console.warn('[lazy-ghost] login pro+ FAIL', e.message);
  }

  const analyzeToken = proPlusToken || proToken;

  // Pro API smoke (no LLM)
  if (proToken) {
    for (const [name, url] of [
      ['macro_usa', '/pro/macro?country=USA&locale=en'],
      ['macro_jpn', '/pro/macro?country=JPN&locale=ja'],
      ['earnings_nvda', '/pro/earnings/NVDA'],
      ['sentiment_nvda', '/pro/sentiment/NVDA?days=30'],
    ]) {
      const r = await apiJson('GET', url, { token: proToken });
      report.checks.push({ name, status: r.status, ok: r.ok });
      const outFile = path.join(OUT_DIR, `${name}.json`);
      fs.writeFileSync(outFile, JSON.stringify(r.json, null, 2));
      console.log(`[lazy-ghost] ${name}`, r.status);
    }
  }

  if (proPlusToken) {
    for (const [name, url, method, body] of [
      ['screener_usage', '/pro/screener/usage', 'GET'],
      ['alerts_settings', '/pro/alerts/settings', 'GET'],
      ['insider_nvda', '/pro/insider/NVDA', 'GET'],
      ['congress_nvda', '/pro/congress/NVDA', 'GET'],
    ]) {
      const r = await apiJson(method, url, { token: proPlusToken, body });
      report.checks.push({ name, status: r.status, ok: r.ok });
      fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(r.json, null, 2));
      console.log(`[lazy-ghost] ${name}`, r.status);
    }
  }

  // Sample fallback (no auth)
  const sample = await apiJson('GET', '/sample/NVDA?locale=en&format=json');
  if (sample.ok && sample.json?.vizSnapshot) {
    const md = snapshotToMarkdown('Sample NVDA (public, free-tier redacted)', {
      vizSnapshot: sample.json.vizSnapshot,
      meta: { ticker: 'NVDA', locale: 'en', tier: 'sample' },
    });
    fs.writeFileSync(path.join(OUT_DIR, 'sample-NVDA-en.md'), md);
    fs.writeFileSync(path.join(OUT_DIR, 'sample-NVDA-en.json'), JSON.stringify(sample.json, null, 2));
    report.checks.push({ name: 'sample_nvda', ok: true });
    console.log('[lazy-ghost] sample NVDA OK');
  } else {
    report.checks.push({ name: 'sample_nvda', ok: false, status: sample.status });
    console.log('[lazy-ghost] sample NVDA', sample.status);
  }

  // Full analyze runs (Pro+ preferred)
  const cases = [
    {
      id: 'NVDA-en',
      body: { ticker: 'NVDA', assetType: 'stock', horizon: '3m', locale: 'en', macroCountry: 'USA', forceRefresh: false },
    },
    {
      id: '7203.T-ja',
      body: {
        ticker: '7203.T',
        assetType: 'stock',
        horizon: '3m',
        locale: 'ja',
        macroCountry: 'JPN',
        forceRefresh: false,
      },
    },
  ];

  if (analyzeToken) {
    for (const c of cases) {
      console.log(`[lazy-ghost] analyze ${c.id} … (may take 2–5 min)`);
      const t0 = Date.now();
      try {
        const result = await consumeAnalyzeStream(analyzeToken, c.body);
        const lc = localeCheck(c.body.locale, result.vizSnapshot);
        const entry = {
          id: c.id,
          ms: Date.now() - t0,
          locale: c.body.locale,
          macroCountry: c.body.macroCountry,
          signal: result.vizSnapshot.signal,
          score: result.vizSnapshot.score,
          model: result.meta?.model,
          cached: result.meta?.cached,
          localeCheck: lc,
          warning: result.warning,
        };
        report.analyses.push(entry);

        const md = snapshotToMarkdown(`Analysis ${c.id}`, result);
        fs.writeFileSync(path.join(OUT_DIR, `report-${c.id}.md`), md);
        fs.writeFileSync(
          path.join(OUT_DIR, `report-${c.id}.json`),
          JSON.stringify({ meta: result.meta, vizSnapshot: result.vizSnapshot }, null, 2),
        );
        console.log(
          `[lazy-ghost] ${c.id} OK ${Math.round(entry.ms / 1000)}s signal=${entry.signal} cjk=${lc.cjk}`,
        );
      } catch (e) {
        report.errors.push({ step: `analyze_${c.id}`, message: e.message });
        console.error(`[lazy-ghost] ${c.id} FAIL`, e.message);
      }
    }
  } else {
    report.errors.push({
      step: 'analyze',
      message: 'No test account on production — set SEED_TEST_ACCOUNTS=1 and redeploy',
    });
  }

  // Summary markdown
  const summaryLines = [
    '# 懒惰鬼测试报告',
    '',
    `**时间:** ${report.at}`,
    `**目标:** ${BASE}`,
    '',
    '## 探活 / API',
    '',
    '| 检查项 | 结果 |',
    '|--------|------|',
  ];
  for (const c of report.checks) {
    summaryLines.push(`| ${c.name} | ${c.ok ? '✅' : '❌'} ${c.status || ''} |`);
  }
  summaryLines.push('', '## 分析报告', '');
  if (report.analyses.length) {
    for (const a of report.analyses) {
      summaryLines.push(`### ${a.id}`);
      summaryLines.push(`- 耗时: ${Math.round(a.ms / 1000)}s`);
      summaryLines.push(`- Signal: ${a.signal} / Score: ${a.score}`);
      summaryLines.push(`- Macro: ${a.macroCountry}`);
      summaryLines.push(`- CJK chars: ${a.localeCheck.cjk}`);
      if (a.localeCheck.issues.length) {
        summaryLines.push(`- ⚠️ ${a.localeCheck.issues.join('; ')}`);
      } else {
        summaryLines.push(`- Locale check: OK`);
      }
      summaryLines.push(`- 报告文件: \`report-${a.id}.md\``);
      summaryLines.push('');
    }
  } else {
    summaryLines.push('_未生成实时分析（见 errors）_');
    summaryLines.push('');
  }
  if (report.errors.length) {
    summaryLines.push('## Errors', '');
    for (const e of report.errors) {
      summaryLines.push(`- **${e.step}:** ${e.message}`);
    }
  }
  summaryLines.push('', '## 你这边 UI 手测清单', '');
  summaryLines.push('- [ ] 登录 pro / pro+ 测试号，首页跑 NVDA');
  summaryLines.push('- [ ] `/tools` 宏观国家自动/锁定');
  summaryLines.push('- [ ] `/compare` 三标的雷达 + CSV');
  summaryLines.push('- [ ] `/screener` Pro+ 筛股');
  summaryLines.push('- [ ] `/settings#alerts` 风险提醒开关');

  const summaryMd = summaryLines.join('\n');
  fs.writeFileSync(path.join(OUT_DIR, '懒惰鬼-测试报告.md'), summaryMd);
  fs.writeFileSync(path.join(OUT_DIR, 'lazy-ghost-report.json'), JSON.stringify(report, null, 2));

  console.log('\n[lazy-ghost] Done →', path.join(OUT_DIR, '懒惰鬼-测试报告.md'));
}

main().catch((e) => {
  console.error('[lazy-ghost] FATAL', e);
  process.exit(1);
});
