/**
 * Post-process analysis JSON for freshness, dated sources, and quote alignment.
 * Complements prompt rules in promptSearchRules.cjs.
 */

const STALE_DAYS = {
  news: 14,
  policy: 7,
  fundamentals: 90,
  quoteSession: 4,
};

function parseYmd(raw) {
  const s = String(raw || '').trim();
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (!m) return null;
  const day = m[3] ? m[3] : '01';
  const d = new Date(`${m[1]}-${m[2]}-${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function downgradeCredibility(c) {
  const u = String(c || '').toLowerCase();
  if (u === '高' || u === 'high') return '中';
  if (u === '中' || u === 'mid' || u === 'medium') return '低';
  return '低';
}

function accuracyTrustPromptBlock(loc) {
  const zh = String(loc || '').startsWith('zh');
  if (zh) {
    return `
【准确性与信任（最高优先级）】
1. 宁可写「未能核验」或留空，也不编造数字、日期、政策状态或财报数据。
2. 所有关键事实须可对应 sources[] 中带日期的条目；无日期则不得写入 score/signal/outlook 的关键论据。
3. 新闻/政策/监管类：优先 7 日内来源；超过 14 日须在正文标注「⚠️ 信息可能过时」，且不得当作「最新」叙述。
4. 现价、涨跌幅、均线、目标价：以【Alpha Vantage 已拉取】为准；dataAsOf 填最近交易日（YYYY-MM-DD）。
5. 发现正反报道矛盾：以**日期最新**者为准，并在 riskBlindSpot 或 outlook 写明「存在争议，以 YYYY-MM-DD 报道为准」。
6. 禁止把历史事件（如旧财报、已结束的政策窗口）写成当前进行时。
7. catalyst/keyEvents 的 date 须为未来或近 7 日内已发生事实；无法确认日期则写「待公告」。
8. 若联网检索不足，降低 score、倾向 HOLD，并在 summary 点明「证据不足」。`;
  }
  return `
【Accuracy & trust (top priority)】
1. Never invent numbers, dates, policy status, or filings; leave fields empty if unverified.
2. Every material claim must map to a dated sources[] entry; undated sources cannot support key conclusions.
3. News/policy: prefer ≤7 days; >14 days must be labeled "⚠️ may be stale" and not framed as "latest".
4. Price/technicals: follow the Alpha Vantage block; set dataAsOf to the latest trading session (YYYY-MM-DD).
5. Conflicting reports: prefer the newest date and state the conflict explicitly in riskBlindSpot/outlook.
6. Do not present past events as current.
7. keyEvents dates must be future or within ~7 days; otherwise use "TBD".
8. If search is thin, lower score, bias to HOLD, and say "limited evidence" in summary.`;
}

function isPolicyLikeText(text) {
  return /政策|监管|禁令|出口|合规|立法|反垄断|实体清单|管制|regulat|sanction|export control|antitrust|compliance/i.test(
    String(text || ''),
  );
}

function tagStaleInText(text, loc) {
  const t = String(text || '').trim();
  if (!t || /过时|stale|may be stale/i.test(t)) return t;
  return String(loc || '').startsWith('zh') ? `${t} ⚠️ 信息可能过时` : `${t} ⚠️ may be stale`;
}

/**
 * @param {object} data - parsed main model JSON (mutated)
 * @param {{ locale?: string, globalQuote?: object|null }} ctx
 */
function enforceReportAccuracy(data, ctx = {}) {
  if (!data || typeof data !== 'object') return { warnings: [] };
  const loc = String(ctx.locale || 'zh-CN');
  const zh = loc.startsWith('zh');
  const warnings = [];

  const gq = ctx.globalQuote && typeof ctx.globalQuote === 'object' ? ctx.globalQuote : null;
  const tradingDay = gq ? String(gq['07. latest trading day'] || '').trim() : '';
  const avDate = parseYmd(tradingDay);
  let qAge = null;
  if (avDate && tradingDay) {
    data.quoteAsOf = tradingDay;
    const modelDate = parseYmd(data.dataAsOf);
    if (!modelDate || modelDate < avDate) {
      data.dataAsOf = tradingDay;
    }
    qAge = daysSince(avDate);
    if (qAge != null && qAge > STALE_DAYS.quoteSession) {
      warnings.push(
        zh
          ? `行情最近交易日为 ${tradingDay}（${qAge} 天前），现价可能已偏离`
          : `Quote session ${tradingDay} is ${qAge}d old; price may have moved`,
      );
    }
  }

  let staleSourceCount = 0;
  let undatedSourceCount = 0;
  const sources = Array.isArray(data.sources) ? data.sources : [];
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const blob = `${s.text || ''} ${s.cite || ''}`;
    const d = parseYmd(s.time);
    if (!d) {
      undatedSourceCount += 1;
      s.credibility = downgradeCredibility(s.credibility);
      const base = String(s.text || '').trim();
      s.text = base.includes('⚠️')
        ? base
        : `${base}${zh ? ' ⚠️ 来源无日期' : ' ⚠️ undated source'}`.trim();
      continue;
    }
    const age = daysSince(d);
    const maxDays = isPolicyLikeText(blob) ? STALE_DAYS.policy : STALE_DAYS.news;
    if (age != null && age > maxDays) {
      staleSourceCount += 1;
      s._stale = true;
      s.text = tagStaleInText(s.text, loc);
      if (s.credibility === '高' || String(s.credibility).toLowerCase() === 'high') {
        s.credibility = '中';
      }
    }
  }
  data.sources = sources;

  if (undatedSourceCount > 0) {
    warnings.push(
      zh
        ? `${undatedSourceCount} 条来源缺少日期，可信度已降级`
        : `${undatedSourceCount} source(s) lack dates; credibility downgraded`,
    );
  }
  if (staleSourceCount > 0) {
    warnings.push(
      zh
        ? `${staleSourceCount} 条来源超过时效阈值，已标注可能过时`
        : `${staleSourceCount} source(s) exceed freshness threshold`,
    );
  }

  const outlook = String(data.outlook || '');
  const summary = String(data.summary || '');
  if (/20(1[0-9]|2[0-3])\s*年/.test(outlook + summary) && !/历史|回顾|去年|FY20/i.test(outlook + summary)) {
    warnings.push(
      zh
        ? '正文含较早年份表述，请核对是否误作「当前」信息'
        : 'Narrative may cite old years as current—verify wording',
    );
  }

  let freshnessScore = 100;
  freshnessScore -= Math.min(40, staleSourceCount * 12);
  freshnessScore -= Math.min(30, undatedSourceCount * 15);
  if (qAge != null && qAge > STALE_DAYS.quoteSession) freshnessScore -= 15;
  data.freshnessScore = Math.max(0, Math.min(100, freshnessScore));

  if (freshnessScore < 70 && !data.riskBlindSpot) {
    data.riskBlindSpot = zh
      ? '部分论据来源较旧或未标注日期，结论不确定性较高'
      : 'Some inputs are dated or undated; higher uncertainty';
  } else if (freshnessScore < 70 && data.riskBlindSpot) {
    const rb = String(data.riskBlindSpot || '').trim();
    if (!/过时|undated|stale|日期/i.test(rb)) {
      data.riskBlindSpot = `${rb} ${zh ? '（含过时或未标注日期来源）' : '(includes stale/undated sources)'}`.trim();
    }
  }

  data.trustWarnings = warnings;
  return { warnings, freshnessScore: data.freshnessScore };
}

module.exports = {
  STALE_DAYS,
  accuracyTrustPromptBlock,
  enforceReportAccuracy,
  parseYmd,
  daysSince,
};
