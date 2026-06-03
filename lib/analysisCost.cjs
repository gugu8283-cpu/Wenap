/**
 * Analysis log cost: prefer OpenRouter usage.cost; fallback to per-model estimates.
 */

/** USD per 1M tokens (input, output) — fallback when usage.cost missing */
const MODEL_RATES = [
  { match: (m) => /gpt-5\.4-mini|gpt-5-mini/i.test(m), in: 0.75, out: 4.5 },
  { match: (m) => /haiku/i.test(m), in: 0.8, out: 4 },
  { match: (m) => /sonnet/i.test(m), in: 3, out: 15 },
  { match: (m) => /flash-lite/i.test(m), in: 0.075, out: 0.3 },
  { match: (m) => /flash/i.test(m), in: 0.15, out: 0.6 },
  { match: (m) => /gemini.*pro/i.test(m), in: 1.25, out: 5 },
];

function normalizeModelSlug(model) {
  const s = String(model || '').trim();
  if (!s) return '';
  if (s.startsWith('hybrid:')) {
    const inner = s.slice(7);
    const plus = inner.indexOf('+');
    return plus >= 0 ? inner.slice(0, plus).trim() : inner;
  }
  return s;
}

function estimateCostUsd(inputTokens, outputTokens, model) {
  const inp = Number(inputTokens) || 0;
  const out = Number(outputTokens) || 0;
  const slug = normalizeModelSlug(model);
  for (const row of MODEL_RATES) {
    if (row.match(slug)) return (inp / 1e6) * row.in + (out / 1e6) * row.out;
  }
  return (inp / 1e6) * 0.1 + (out / 1e6) * 0.4;
}

function usageCostUsd(slice) {
  if (!slice || typeof slice !== 'object') return null;
  const c = Number(slice.cost);
  if (Number.isFinite(c) && c >= 0) return c;
  const details = slice.cost_details;
  if (details && typeof details === 'object') {
    const up = Number(details.upstream_inference_cost);
    if (Number.isFinite(up) && up >= 0) return up;
    const sum =
      (Number(details.upstream_inference_prompt_cost) || 0) +
      (Number(details.upstream_inference_completions_cost) || 0);
    if (sum > 0) return sum;
  }
  return null;
}

function tokenParts(usageSlice) {
  if (!usageSlice || typeof usageSlice !== 'object') {
    return { inp: 0, out: 0 };
  }
  const inp = Number(usageSlice.prompt_tokens) || 0;
  const out = Number(usageSlice.completion_tokens) || 0;
  if (inp || out) return { inp, out };
  const total = Number(usageSlice.total_tokens) || 0;
  return { inp: Math.round(total * 0.7), out: Math.round(total * 0.3) };
}

function costForUsageSlice(slice, modelName) {
  const fromApi = usageCostUsd(slice);
  if (fromApi != null) return { cost: fromApi, fromApi: true };
  const { inp, out } = tokenParts(slice);
  if (!inp && !out) return { cost: 0, fromApi: false };
  return { cost: estimateCostUsd(inp, out, modelName), fromApi: false };
}

function mergeUsageSlices(a, b) {
  if (!a && !b) return null;
  if (!a) return b && typeof b === 'object' ? { ...b } : null;
  if (!b) return a && typeof a === 'object' ? { ...a } : null;
  const inp = (Number(a.prompt_tokens) || 0) + (Number(b.prompt_tokens) || 0);
  const out = (Number(a.completion_tokens) || 0) + (Number(b.completion_tokens) || 0);
  const total = (Number(a.total_tokens) || 0) + (Number(b.total_tokens) || 0);
  const costA = usageCostUsd(a);
  const costB = usageCostUsd(b);
  const merged = {
    prompt_tokens: inp,
    completion_tokens: out,
    total_tokens: total || inp + out,
  };
  if (costA != null || costB != null) {
    merged.cost = (costA || 0) + (costB || 0);
  }
  return merged;
}

/**
 * @param {object} usage - usageLog from analyze pipeline
 * @param {string} mainModel - display label (may be hybrid:...)
 * @param {string} policyModel
 * @param {string} critiqueModel
 */
function estimateAnalysisCostUsd(usage, mainModel, policyModel, critiqueModel) {
  let cost = 0;
  let inp = 0;
  let out = 0;
  let anyApiCost = false;

  const add = (slice, modelName) => {
    const { cost: c, fromApi } = costForUsageSlice(slice, modelName);
    if (!c && !fromApi) {
      const parts = tokenParts(slice);
      if (!parts.inp && !parts.out) return;
    }
    cost += c;
    if (fromApi) anyApiCost = true;
    const parts = tokenParts(slice);
    inp += parts.inp;
    out += parts.out;
  };

  const mainSliceModel =
    String(usage?.pass1Model || '').trim() ||
    (usage?.hybrid ? normalizeModelSlug(mainModel) : mainModel);

  add(usage?.main, mainSliceModel);

  if (usage?.pass2) {
    const pass2Model =
      String(usage?.pass2Model || process.env.OPENROUTER_PRO_PLUS_PASS2_MODEL || '').trim() ||
      'google/gemini-2.5-flash-lite';
    add(usage.pass2, pass2Model);
  }

  if (!usage?.leaderSkipped) {
    add(usage?.leader, policyModel || 'google/gemini-2.5-flash');
  }

  add(usage?.critique, critiqueModel || 'anthropic/claude-haiku-4-5');

  return {
    cost: Math.round(cost * 1e6) / 1e6,
    inp,
    out,
    costFromApi: anyApiCost,
  };
}

module.exports = {
  estimateCostUsd,
  estimateAnalysisCostUsd,
  mergeUsageSlices,
  usageCostUsd,
  tokenParts,
  normalizeModelSlug,
};
