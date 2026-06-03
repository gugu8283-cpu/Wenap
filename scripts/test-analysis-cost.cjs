const assert = require('assert');
const {
  estimateAnalysisCostUsd,
  mergeUsageSlices,
  usageCostUsd,
} = require('../lib/analysisCost.cjs');

const usageWithOrCost = {
  hybrid: true,
  pass1Model: 'anthropic/claude-haiku-4-5',
  pass2Model: 'google/gemini-2.5-flash-lite',
  main: { prompt_tokens: 1000, completion_tokens: 500, cost: 0.002 },
  pass2: { prompt_tokens: 800, completion_tokens: 400, cost: 0.0008 },
  leaderSkipped: true,
  critique: { prompt_tokens: 200, completion_tokens: 100, cost: 0.0003 },
};

const r = estimateAnalysisCostUsd(
  usageWithOrCost,
  'hybrid:anthropic/claude-haiku-4-5+google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'anthropic/claude-haiku-4-5',
);
assert.ok(r.costFromApi, 'should use OpenRouter cost');
assert.ok(Math.abs(r.cost - 0.0031) < 0.0001, `expected ~0.0031 got ${r.cost}`);

const merged = mergeUsageSlices(
  { prompt_tokens: 1, completion_tokens: 2, cost: 0.1 },
  { prompt_tokens: 3, completion_tokens: 4, cost: 0.2 },
);
assert.ok(Math.abs(merged.cost - 0.3) < 1e-9);
assert.strictEqual(usageCostUsd({ cost: 0.42 }), 0.42);

console.log('[test-analysis-cost] OK');
