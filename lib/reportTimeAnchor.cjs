/**
 * Anchor report dates to market data session; clamp dated fields to a valid window.
 */
const { parseYmd, daysSince } = require('./reportAccuracy.cjs');

function formatYmd(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(ymd, deltaDays) {
  const d = parseYmd(ymd);
  if (!d) return '';
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + deltaDays);
  return formatYmd(x);
}

function timeAnchorPromptBlock(loc) {
  const zh = String(loc || '').startsWith('zh');
  if (zh) {
    return `
【时间口径（硬性）】
1. dataAsOf、quoteAsOf 必须等于【Alpha Vantage 已拉取】中的「最近交易日」，禁止填今天日期、禁止填未来日期。
2. sources[].time、正文角标中的日期：不得晚于 dataAsOf；不得早于 dataAsOf 往前 24 个月（过时须标注「可能过时」）。
3. keyEvents[].date：已发生事件须在 [dataAsOf-7日, dataAsOf]；未来催化剂须在 (dataAsOf, dataAsOf+180日]；无法确认写「待公告」。
4. 禁止把 2020–2023 年事件写成「当前」或「最新」；历史须用「2024年」「此前」等过去时态。
5. outlook/technicalSnapshot 中的「最新」「目前」仅指 dataAsOf 当日或该交易日收盘口径。`;
  }
  return `
【Time anchor (mandatory)】
1. dataAsOf and quoteAsOf MUST equal the "latest trading day" from the Alpha Vantage block—never today's calendar date or a future date.
2. sources[].time and in-text cite dates: must not be after dataAsOf; must not be before dataAsOf minus 24 months (older items need a stale label).
3. keyEvents[].date: past events in [dataAsOf-7d, dataAsOf]; forward catalysts in (dataAsOf, dataAsOf+180d]; unknown → "TBD".
4. Do not describe 2020–2023 events as "current" or "latest"; use explicit past tense.
5. Words like "latest" / "currently" mean as of dataAsOf (that session) only.`;
}

/**
 * @param {object} data
 * @param {{ tradingDay?: string, locale?: string }} ctx
 */
function anchorReportTimes(data, ctx = {}) {
  if (!data || typeof data !== 'object') return [];
  const loc = String(ctx.locale || 'zh-CN');
  const zh = loc.startsWith('zh');
  const warnings = [];
  const tradingDay = String(ctx.tradingDay || '').trim();
  let anchor = parseYmd(tradingDay);
  if (!anchor) anchor = parseYmd(data.dataAsOf);
  if (!anchor) anchor = new Date();
  const anchorStr = formatYmd(anchor);
  const minSource = addDaysYmd(anchorStr, -730);
  const maxFuture = addDaysYmd(anchorStr, 180);
  const minPastEvent = addDaysYmd(anchorStr, -7);

  data.dataAsOf = anchorStr;
  data.quoteAsOf = anchorStr;

  const sources = Array.isArray(data.sources) ? data.sources : [];
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const d = parseYmd(s.time);
    if (!d) continue;
    const ymd = formatYmd(d);
    if (ymd > anchorStr) s.time = anchorStr;
    else if (minSource && ymd < minSource) {
      s.time = minSource;
      s.text = String(s.text || '').includes('⚠️')
        ? s.text
        : `${String(s.text || '').trim()} ${zh ? '⚠️ 可能过时' : '⚠️ may be stale'}`.trim();
    }
  }
  data.sources = sources;

  const clampEventDate = (raw) => {
    const s = String(raw || '').trim();
    if (!s || /待公告|TBD|未定/i.test(s)) return s;
    const d = parseYmd(s);
    if (!d) return s;
    const ymd = formatYmd(d);
    if (ymd > maxFuture) return maxFuture;
    if (ymd < minSource) return minSource;
    return ymd;
  };

  if (Array.isArray(data.keyEvents)) {
    data.keyEvents = data.keyEvents.map((ev) => {
      if (!ev || typeof ev !== 'object') return ev;
      return { ...ev, date: clampEventDate(ev.date || ev.eta) };
    });
  }

  if (Array.isArray(data.catalystTimeline)) {
    data.catalystTimeline = data.catalystTimeline.map((ev) => {
      if (!ev || typeof ev !== 'object') return ev;
      const date = clampEventDate(ev.eta || ev.date);
      return { ...ev, eta: date, date };
    });
  }

  const modelAsOf = parseYmd(data.dataAsOf);
  if (tradingDay && modelAsOf && formatYmd(modelAsOf) !== tradingDay) {
    warnings.push(
      zh
        ? `已将数据口径统一为行情交易日 ${tradingDay}`
        : `Data as-of aligned to quote session ${tradingDay}`,
    );
  }

  return warnings;
}

module.exports = {
  timeAnchorPromptBlock,
  anchorReportTimes,
  formatYmd,
};
