'use strict';

const assert = require('assert');
const {
  formatPriceAsOfDisplay,
  currentPricePromptBlock,
  dataFreshnessPromptBlock,
} = require('../lib/alphaMarketSnapshot.cjs');
const { dataFreshnessPromptBlock: fromAccuracy } = require('../lib/reportAccuracy.cjs');

assert.match(formatPriceAsOfDisplay('2026-01-01', new Date().toISOString()), /^2026-01-01 16:00$/);
assert.match(currentPricePromptBlock(100.5, 'USD', 'en'), /Current price is \$100\.50/);
assert.match(currentPricePromptBlock(100.5, 'USD', 'en'), /Do NOT override/);
assert.ok(dataFreshnessPromptBlock('zh-CN').includes('7 天'));
assert.ok(fromAccuracy('en').includes('7 days'));

console.log('test-alpha-market-snapshot.cjs OK');
