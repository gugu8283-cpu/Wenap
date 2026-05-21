/**
 * Parse current / target price from analystPriceLine + optional Alpha latest quote.
 */

function parseMoneyToken(raw) {
  const n = parseFloat(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

function parsePricesFromLine(line, latestUsd) {
  let current = Number.isFinite(latestUsd) && latestUsd > 0 ? latestUsd : NaN;
  let target = NaN;
  const t = String(line || '');

  const curPatterns = [
    /当前价[^$￥¥0-9]*[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    /现价[^$￥¥0-9]*[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    /current\s*(?:price)?[^$0-9]*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /spot[^$0-9]*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:at|@)\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
  ];
  for (const re of curPatterns) {
    const m = t.match(re);
    if (m) {
      const v = parseMoneyToken(m[1]);
      if (Number.isFinite(v)) {
        current = v;
        break;
      }
    }
  }

  const tgtPatterns = [
    /目标价[^$￥¥0-9]*[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    /target\s*(?:price)?[^$0-9]*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /目标[^$￥¥0-9]*[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
  ];
  for (const re of tgtPatterns) {
    const m = t.match(re);
    if (m) {
      const v = parseMoneyToken(m[1]);
      if (Number.isFinite(v)) {
        target = v;
        break;
      }
    }
  }

  if (!Number.isFinite(target)) {
    const nums = [...t.matchAll(/[$￥¥]?\s*([\d,]+(?:\.\d+)?)/g)]
      .map((m) => parseMoneyToken(m[1]))
      .filter((n) => Number.isFinite(n));
    if (nums.length >= 2) {
      const uniq = [...new Set(nums)];
      if (Number.isFinite(current)) {
        const others = uniq.filter((n) => Math.abs(n - current) > 0.01);
        if (others.length) target = others[others.length - 1];
      } else {
        current = uniq[0];
        target = uniq[uniq.length - 1];
      }
    } else if (nums.length === 1 && !Number.isFinite(current)) {
      current = nums[0];
    }
  }

  let upside = NaN;
  if (Number.isFinite(current) && Number.isFinite(target) && current > 0) {
    upside = Math.round(((target - current) / current) * 100);
  }
  return { current, target, upside };
}

module.exports = { parsePricesFromLine, parseMoneyToken };
