/**
 * Client-side citation bracket cleanup for cached snapshots (non-zh UI).
 */

const ZH_BRACKET_TO_EN = [
  ['来源', 'Source'],
  ['來源', 'Source'],
  ['交易所', 'Exchange'],
  ['披露', 'Filing'],
  ['新闻', 'News'],
  ['新聞', 'News'],
  ['研报', 'Research'],
  ['研報', 'Research'],
  ['行情', 'Quote'],
  ['官网', 'IR'],
  ['官網', 'IR'],
  ['媒体', 'Media'],
  ['媒體', 'Media'],
];

function isZhLocale(locale) {
  const s = String(locale || '').toLowerCase().replace(/_/g, '-')
  return s.startsWith('zh')
}

export function localizeCitationBrackets(text, locale) {
  if (isZhLocale(locale)) return String(text ?? '')
  let t = String(text ?? '')
  if (!t) return t
  for (const [zh, en] of ZH_BRACKET_TO_EN) {
    const esc = zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`\\[${esc}\\]`, 'g'), `[${en}]`)
    t = t.replace(new RegExp(`\\(${esc}\\)`, 'g'), `(${en})`)
    t = t.replace(new RegExp(`（${esc}）`, 'g'), `(${en})`)
  }
  return t
}

export function defaultSourceLabel(locale) {
  const s = String(locale || '').toLowerCase().replace(/_/g, '-')
  if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s === 'zh-hant') return '來源'
  if (s.startsWith('zh')) return '来源'
  if (s.startsWith('ja')) return '出典'
  if (s.startsWith('ko')) return '출처'
  if (s.startsWith('de')) return 'Quelle'
  return 'Source'
}

/** @param {import('../types/analysis.js').MobileReport} report */
export function localizeMobileReportCitations(report, locale) {
  if (!report || isZhLocale(locale)) return report
  const loc = (s) => localizeCitationBrackets(s, locale)
  if (report.forecast) report.forecast = loc(report.forecast)
  if (report.forecastAssumption) report.forecastAssumption = loc(report.forecastAssumption)
  if (report.technicalSnapshot) report.technicalSnapshot = loc(report.technicalSnapshot)
  if (report.summary) report.summary = loc(report.summary)
  if (report.riskBlindSpot) report.riskBlindSpot = loc(report.riskBlindSpot)
  if (report.leaderInsiderSummary) report.leaderInsiderSummary = loc(report.leaderInsiderSummary)
  if (Array.isArray(report.dimensions)) {
    report.dimensions = report.dimensions.map((d) => ({
      ...d,
      reason: loc(d.reason),
    }))
  }
  if (Array.isArray(report.scenarios)) {
    report.scenarios = report.scenarios.map((s) => ({
      ...s,
      trigger: loc(s.trigger),
    }))
  }
  if (Array.isArray(report.supplyChain)) {
    report.supplyChain = report.supplyChain.map((r) => ({
      ...r,
      relation: loc(r.relation),
      analysis: loc(r.analysis),
    }))
  }
  if (report.coreConclusion) {
    report.coreConclusion = {
      ...report.coreConclusion,
      headline: loc(report.coreConclusion.headline),
      ifBull: loc(report.coreConclusion.ifBull),
      ifBear: loc(report.coreConclusion.ifBear),
      action: loc(report.coreConclusion.action),
    }
  }
  if (Array.isArray(report.sources)) {
    report.sources = report.sources.map((s) => ({
      ...s,
      title: loc(s.title),
      source: s.source === '来源' || s.source === '來源' ? defaultSourceLabel(locale) : s.source,
    }))
  }
  return report
}
