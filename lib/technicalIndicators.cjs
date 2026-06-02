/**
 * Lightweight technical indicators from daily closes (oldest → newest).
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function sma(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      out.push(NaN);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return out;
}

function ema(values, period) {
  const out = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(values[0]);
      continue;
    }
    const prev = out[i - 1];
    out.push(values[i] * k + prev * (1 - k));
  }
  return out;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return NaN;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(closes) {
  if (closes.length < 35) return { macd: NaN, signal: NaN, histogram: NaN };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine.filter((x) => Number.isFinite(x)), 9);
  const macdVal = macdLine[macdLine.length - 1];
  const sigVal = signalLine[signalLine.length - 1];
  return {
    macd: macdVal,
    signal: sigVal,
    histogram: macdVal - sigVal,
  };
}

function computeTechnicals(closesOldestFirst) {
  const closes = (closesOldestFirst || []).map(num).filter((x) => Number.isFinite(x) && x > 0);
  if (closes.length < 20) {
    return { ok: false, reason: 'INSUFFICIENT_BARS' };
  }
  const last = closes[closes.length - 1];
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const s20 = sma20[sma20.length - 1];
  const s50 = sma50[sma50.length - 1];
  const rsi14 = rsi(closes, 14);
  const macdObj = macd(closes);
  let trend = 'neutral';
  if (Number.isFinite(s20) && Number.isFinite(s50)) {
    if (last > s20 && s20 > s50) trend = 'bullish';
    else if (last < s20 && s20 < s50) trend = 'bearish';
  }
  return {
    ok: true,
    lastClose: last,
    sma20: s20,
    sma50: s50,
    rsi14,
    macd: macdObj.macd,
    macdSignal: macdObj.signal,
    macdHistogram: macdObj.histogram,
    trend,
    barCount: closes.length,
  };
}

function technicalPromptBlock(tech, locale = 'en') {
  if (!tech?.ok) return '';
  const zh = String(locale || '').startsWith('zh');
  const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');
  const lines = [
    zh
      ? '【自算技术指标】基于 EOD 收盘价（非投资建议）：'
      : '[Computed technicals] From EOD closes (not investment advice):',
    zh
      ? `- 收盘：${fmt(tech.lastClose)} | SMA20：${fmt(tech.sma20)} | SMA50：${fmt(tech.sma50)}`
      : `- Close: ${fmt(tech.lastClose)} | SMA20: ${fmt(tech.sma20)} | SMA50: ${fmt(tech.sma50)}`,
    zh
      ? `- RSI(14)：${fmt(tech.rsi14, 1)} | MACD：${fmt(tech.macd, 3)} / signal ${fmt(tech.macdSignal, 3)}`
      : `- RSI(14): ${fmt(tech.rsi14, 1)} | MACD: ${fmt(tech.macd, 3)} / signal ${fmt(tech.macdSignal, 3)}`,
    zh ? `- 趋势判断：${tech.trend}` : `- Trend bias: ${tech.trend}`,
  ];
  return lines.join('\n');
}

module.exports = {
  computeTechnicals,
  technicalPromptBlock,
};
