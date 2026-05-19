const fs = require('fs');
const path = require('path');

const transcriptPath =
  process.env.TRANSCRIPT ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-Yap-Wei-Jun-Downloads-app/agent-transcripts/fc4b5e9f-31dd-46aa-80e2-dc333a667299/fc4b5e9f-31dd-46aa-80e2-dc333a667299.jsonl',
  );

const root = path.join(__dirname, '..');
const targets = [
  'src/EconomicsPanel.jsx',
  'src/components/analysis/HeroCard.jsx',
  'src/components/analysis/MobileAnalysisReport.jsx',
  'src/components/analysis/ProFieldsSection.jsx',
  'src/components/analysis/BullBearSection.jsx',
  'src/components/analysis/RadarSection.jsx',
  'src/components/analysis/ProLockedSection.jsx',
  'src/components/analysis/ProPlusLockedSection.jsx',
  'src/components/analysis/ProUpgradeBar.jsx',
  'src/components/analysis/ScenarioSection.jsx',
  'src/components/analysis/SourcesAccordion.jsx',
  'src/components/analysis/SupplyChainSection.jsx',
  'src/components/analysis/pro/ProInsiderBlock.jsx',
  'src/components/analysis/pro/ProKeyEventsBlock.jsx',
  'src/utils/parseSources.js',
  'src/utils/parseMarkdown.js',
  'src/utils/snapshotToMobileReport.js',
  'src/utils/supplyRelation.js',
  'src/constants/colors.js',
];

const lines = fs.readFileSync(transcriptPath, 'utf8').split(/\n/).filter(Boolean);
const best = new Map();

for (const line of lines) {
  let j;
  try {
    j = JSON.parse(line);
  } catch {
    continue;
  }
  for (const x of j.message?.content || []) {
    if (x.type !== 'tool_use' || x.name !== 'Write' || !x.input?.contents) continue;
    const p = String(x.input.path || '').replace(/\\/g, '/');
    for (const rel of targets) {
      if (p.endsWith(rel) || p.endsWith(rel.replace(/\//g, '\\'))) {
        const prev = best.get(rel);
        if (!prev || x.input.contents.length > prev.length) {
          best.set(rel, x.input.contents);
        }
      }
    }
  }
}

for (const rel of targets) {
  const content = best.get(rel);
  if (!content) {
    console.warn('skip (not in transcript):', rel);
    continue;
  }
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, 'utf8');
  console.log('restored', rel, content.length);
}
