/** Export /history/:id markdown to docs/lazy-ghost-output */
const fs = require('fs');
const path = require('path');

const BASE = process.env.WENAP_BASE || 'https://wenap.app';
const OUT = path.join(__dirname, '..', 'docs', 'lazy-ghost-output');
const ID = process.argv[2] || '1780398182360-NVDA';

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'proplus@wenap.test', password: 'Wenap2026ProPlus!' }),
  });
  const { token } = await login.json();
  const res = await fetch(`${BASE}/history/${ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  fs.mkdirSync(OUT, { recursive: true });
  const slug = `${data.symbol}-history`;
  if (data.markdown) {
    const md = String(data.markdown)
      .replace(/<<<WENAP_S1>>>/g, '---\n\n')
      .replace(/<<<WENAP_S2>>>/g, '\n\n---\n\n');
    fs.writeFileSync(path.join(OUT, `report-${slug}.md`), `# ${data.symbol} (${data.tier})\n\n${md}`);
  }
  fs.writeFileSync(path.join(OUT, `report-${slug}.json`), JSON.stringify(data, null, 2));
  console.log('exported', slug, 'signal=', data.signal, 'score=', data.score);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
