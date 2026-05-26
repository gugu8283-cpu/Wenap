/**
 * Ensure six radar dimensions stay scored (no N/A) with asset-type-specific dim 6.
 */

const { insufficientDataNote, expectedDimensionNames } = require('./outputLocale.cjs');

function isInsufficientDimensionNote(note, locale) {
  const insuf = insufficientDataNote(locale);
  const t = String(note || '').trim();
  if (!t || t === insuf) return true;
  return /数据不足|Insufficient data|データ不足|데이터 부족|Unzureichende Daten/i.test(t);
}

function hasEtfCompositionCue(note) {
  return /(holding|holdings|top\s*10|concentration|weight|sector|index|constituent|overlap|expense|fee|tracking|重仓|持仓|成分|权重|费率|跟踪|構成|保有)/i.test(
    String(note || ''),
  );
}

function hasReitPayoutCue(note) {
  return /(dividend|yield|payout|ffo|affo|occupancy|distribution|派息|股息|分红|现金流|FFO|出租)/i.test(
    String(note || ''),
  );
}

function hasCommodityStructureCue(note) {
  return /(roll|contango|backwardation|futures|physical|storage|expense|fee|tracking|展期|升贴水|期货|实物|费率|持仓)/i.test(
    String(note || ''),
  );
}

function fallbackNote(locale, assetType) {
  const loc = String(locale || 'zh-CN');
  if (assetType === 'reit') {
    if (loc === 'en') {
      return 'Assessment from yield spread, payout/FFO context, and property cash-flow backdrop (limited issuer detail).';
    }
    if (loc.startsWith('zh')) {
      return '基于股息率、派息覆盖与物业现金流背景的综合评估（公开细节有限）。';
    }
    return 'REIT dividend/cash-flow composite assessment.';
  }
  if (assetType === 'commodity_etf') {
    if (loc === 'en') {
      return 'Assessment from commodity exposure, roll/yield structure, and fee tier (limited holding detail).';
    }
    if (loc.startsWith('zh')) {
      return '基于商品暴露、展期结构与费率档位的综合评估（公开持仓细节有限）。';
    }
    return 'Commodity ETF structure/fee composite assessment.';
  }
  if (loc === 'en') {
    return 'Assessment from index sector tilt, concentration, and fee/tracking context (limited holding detail).';
  }
  if (loc.startsWith('zh')) {
    return '基于指数行业暴露、集中度与费率/跟踪质量的综合评估（公开持仓细节有限）。';
  }
  return 'Composite score from sector exposure, concentration, and cost structure.';
}

function cueChecker(assetType) {
  if (assetType === 'reit') return hasReitPayoutCue;
  if (assetType === 'commodity_etf') return hasCommodityStructureCue;
  return hasEtfCompositionCue;
}

/**
 * Force canonical dim-6 name and fill score when model returned 0 / insufficient.
 * Stock dim 6 handled by applyPolicyDimensionBackdropFloor; skip here.
 */
function applySixthDimensionFloor(dimensions, assetType, locale = 'zh-CN') {
  if (assetType === 'stock') return dimensions;
  if (assetType !== 'etf' && assetType !== 'reit' && assetType !== 'commodity_etf') {
    return dimensions;
  }

  const canonical = expectedDimensionNames(assetType, locale);
  const dim6Name = canonical[5] || '';
  const arr = Array.isArray(dimensions) ? dimensions.map((d) => ({ ...d })) : [];
  if (arr.length < 6) return dimensions;

  for (let i = 0; i < 6; i += 1) {
    arr[i] = { ...arr[i], name: canonical[i] };
  }

  const d = arr[5];
  const raw = Number(d.score);
  const note = String(d.note || '').trim();
  const insuf = isInsufficientDimensionNote(note, locale);
  const hasCue = cueChecker(assetType)(note);
  const needsFloor =
    !Number.isFinite(raw) || raw === 0 || (raw < 10 && insuf) || Boolean(d.scoreUnavailable);

  if (!needsFloor) {
    arr[5] = { ...d, name: dim6Name, scoreUnavailable: false };
    return arr;
  }

  const others = arr
    .slice(0, 5)
    .map((x) => Number(x.score))
    .filter((s) => Number.isFinite(s) && s > 0);
  let score = others.length
    ? Math.round(others.reduce((a, b) => a + b, 0) / others.length)
    : 48;
  if (hasCue && !insuf) {
    score = Math.min(90, Math.max(25, Math.max(score, raw > 0 ? Math.round(raw) : 25)));
  } else {
    score = Math.min(75, Math.max(20, score));
  }

  arr[5] = {
    ...d,
    name: dim6Name,
    score,
    note: insuf || !note ? fallbackNote(locale, assetType) : note,
    scoreUnavailable: false,
  };
  return arr;
}

/** @deprecated */
const applyEtfSixthDimensionFloor = applySixthDimensionFloor;

module.exports = { applySixthDimensionFloor, applyEtfSixthDimensionFloor };
