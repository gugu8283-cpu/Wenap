/**
 * Display text sanitization for viz snapshots — scrub noise, generous caps only.
 * Avoid aggressive clipToCompleteThought limits that cut mid-word in the UI.
 */

const VIZ_TEXT_MAX = {
  identityCheck: 400,
  summary: 600,
  technicalSnapshot: 1200,
  detailAnalysis: 12000,
  outlook: 12000,
  valuationBridge: 800,
  leaderInsiderSummary: 800,
  peerVsSectorLine: 600,
  riskBlindSpot: 600,
  dimensionNote: 800,
  supplyRelation: 600,
  supplyAnalysis: 600,
  scenarioTrigger: 600,
  scenarioRange: 96,
  sourceText: 800,
  keyEventEvent: 400,
  keyEventDate: 48,
  coreField: 2000,
  bullBearReason: 2000,
  secondPassItem: 800,
};

function softCapText(raw, maxChars, scrubbers = {}) {
  const {
    stripHttpUrls = (s) => s,
    scrubNotFoundMetaPhrases = (s) => s,
    scrubInternalDraftMarks = (s) => s,
    trimSuspensionSuffix = (s) => s,
  } = scrubbers;
  let t = String(raw ?? '').trim();
  if (!t) return '';
  t = stripHttpUrls(t);
  t = scrubNotFoundMetaPhrases(t);
  t = scrubInternalDraftMarks(t);
  t = trimSuspensionSuffix(t);
  if (!maxChars || maxChars <= 0) return t;
  const chars = [...t];
  if (chars.length <= maxChars) return t;
  return chars.slice(0, maxChars).join('');
}

/**
 * @param {object} data - parsed report JSON (mutated)
 * @param {object} scrubbers - server scrub helpers
 */
function sanitizeReportDisplayFields(data, scrubbers) {
  if (!data || typeof data !== 'object') return;
  const M = VIZ_TEXT_MAX;
  const cap = (field, max) => {
    data[field] = softCapText(data[field], max, scrubbers);
  };

  cap('identityCheck', M.identityCheck);
  cap('summary', M.summary);
  cap('technicalSnapshot', M.technicalSnapshot);
  cap('detailAnalysis', M.detailAnalysis);
  cap('outlook', M.outlook);
  cap('valuationBridge', M.valuationBridge);
  cap('leaderInsiderSummary', M.leaderInsiderSummary);
  cap('peerVsSectorLine', M.peerVsSectorLine);
  cap('riskBlindSpot', M.riskBlindSpot);

  const dims = Array.isArray(data.dimensions) ? data.dimensions : [];
  for (const d of dims) {
    if (!d || typeof d !== 'object') continue;
    const sc = Number(d.score);
    if (!Number.isFinite(sc) || sc === 0) continue;
    d.note = softCapText(d.note, M.dimensionNote, scrubbers);
  }

  const chain = Array.isArray(data.supplyChain) ? data.supplyChain : [];
  for (const c of chain) {
    if (!c || typeof c !== 'object') continue;
    const rel = String(c.relation || c.reason || '').trim();
    c.relation = softCapText(rel, M.supplyRelation, scrubbers);
    c.reason = c.relation;
    if (c.analysis != null) {
      c.analysis = softCapText(c.analysis, M.supplyAnalysis, scrubbers);
    }
  }

  if (data.scenarios && typeof data.scenarios === 'object') {
    for (const k of ['bull', 'base', 'bear']) {
      const z = data.scenarios[k];
      if (!z || typeof z !== 'object') continue;
      z.trigger = softCapText(z.trigger, M.scenarioTrigger, scrubbers);
      z.range = softCapText(z.range, M.scenarioRange, scrubbers);
    }
  }

  if (Array.isArray(data.sources)) {
    data.sources = data.sources.map((s) => {
      if (!s || typeof s !== 'object') return s;
      return { ...s, text: softCapText(s.text, M.sourceText, scrubbers) };
    });
  }

  if (data.coreConclusion && typeof data.coreConclusion === 'object') {
    const cc = data.coreConclusion;
    cc.headline = softCapText(cc.headline, M.coreField, scrubbers);
    cc.ifBull = softCapText(cc.ifBull || cc.bullCase, M.coreField, scrubbers);
    cc.ifBear = softCapText(cc.ifBear || cc.bearCase, M.coreField, scrubbers);
    cc.action = softCapText(cc.action, M.coreField, scrubbers);
  }

  const normBb = (arr) =>
    (Array.isArray(arr) ? arr : []).map((x) => {
      if (!x || typeof x !== 'object') return x;
      return {
        ...x,
        reason: softCapText(x.reason || x.text, M.bullBearReason, scrubbers),
      };
    });
  if (data.bullBearDebate && typeof data.bullBearDebate === 'object') {
    data.bullBearDebate = {
      bull: normBb(data.bullBearDebate.bull),
      bear: normBb(data.bullBearDebate.bear),
    };
  }

  if (data.secondPassCritique && typeof data.secondPassCritique === 'object') {
    const sp = data.secondPassCritique;
    if (sp.blindSpot) sp.blindSpot = softCapText(sp.blindSpot, M.secondPassItem, scrubbers);
    if (Array.isArray(sp.weaknesses)) {
      sp.weaknesses = sp.weaknesses.map((w) => softCapText(w, M.secondPassItem, scrubbers));
    }
  }
}

module.exports = { VIZ_TEXT_MAX, softCapText, sanitizeReportDisplayFields };
