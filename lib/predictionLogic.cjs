const TENDENCY_THRESHOLD = Number(process.env.TENDENCY_THRESHOLD) || 5;

function signalToTendency(sig) {
  const u = String(sig || '').toUpperCase();
  if (u === 'BUY') return 'buy';
  if (u === 'SELL') return 'sell';
  return 'hold';
}

function checkTendency(tendency, priceChangePct) {
  const t = String(tendency || 'hold').toLowerCase();
  const p = Number(priceChangePct) || 0;
  if (t === 'buy') return p > TENDENCY_THRESHOLD;
  if (t === 'sell') return p < -TENDENCY_THRESHOLD;
  return p >= -TENDENCY_THRESHOLD && p <= TENDENCY_THRESHOLD;
}

function checkScenario(actualPrice, prediction) {
  const p = Number(actualPrice);
  if (!Number.isFinite(p)) return 'none';
  const inRange = (min, max) => Number.isFinite(min) && Number.isFinite(max) && p >= min && p <= max;
  if (inRange(prediction.scenario_bull_min, prediction.scenario_bull_max)) return 'bull';
  if (inRange(prediction.scenario_base_min, prediction.scenario_base_max)) return 'base';
  if (inRange(prediction.scenario_bear_min, prediction.scenario_bear_max)) return 'bear';
  return 'none';
}

function parseScenarioRange(rangeStr) {
  const s = String(rangeStr || '');
  const nums = s.match(/[\d,]+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return { min: null, max: null };
  const a = parseFloat(nums[0].replace(/,/g, ''));
  const b = parseFloat(nums[1].replace(/,/g, ''));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { min: null, max: null };
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function parsePricesFromReport(data, latestPriceUsd) {
  let current = Number(latestPriceUsd);
  let target = NaN;
  const line = String(data?.analystPriceLine || '');
  const curM = line.match(/当前价[^$￥0-9]*([\d,]+(?:\.\d+)?)/i);
  if (curM) current = parseFloat(curM[1].replace(/,/g, ''));
  const tgtM = line.match(/目标价[^$￥0-9]*\$?\s*([\d,]+(?:\.\d+)?)/i);
  if (tgtM) target = parseFloat(tgtM[1].replace(/,/g, ''));
  if (!Number.isFinite(current) || current <= 0) current = 0;
  return { current, target: Number.isFinite(target) ? target : null };
}

function scenarioFields(data) {
  const sc = data?.scenarios && typeof data.scenarios === 'object' ? data.scenarios : {};
  const pack = (key) => {
    const z = sc[key];
    if (!z) return { prob: null, min: null, max: null };
    const { min, max } = parseScenarioRange(z.range);
    return { prob: Number(z.p) || 0, min, max };
  };
  const bull = pack('bull');
  const base = pack('base');
  const bear = pack('bear');
  return { bull, base, bear };
}

module.exports = {
  TENDENCY_THRESHOLD,
  signalToTendency,
  checkTendency,
  checkScenario,
  parsePricesFromReport,
  scenarioFields,
};
