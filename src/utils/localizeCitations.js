/**
 * Client-side citation bracket cleanup for cached snapshots (non-zh UI).
 * Mirrors lib/citationLocale.cjs mapping per locale.
 */

const ZH_TAG_FIELD = [
  ['来源', 'default'],
  ['來源', 'default'],
  ['交易所', 'exchange'],
  ['披露', 'filing'],
  ['新闻', 'news'],
  ['新聞', 'news'],
  ['研报', 'research'],
  ['研報', 'research'],
  ['行情', 'quote'],
  ['官网', 'ir'],
  ['官網', 'ir'],
  ['媒体', 'ir'],
  ['媒體', 'ir'],
]

const CITE_LABEL = {
  en: {
    default: 'Source',
    exchange: 'Exchange',
    filing: 'Filing',
    news: 'News',
    research: 'Research',
    quote: 'Quote',
    ir: 'IR',
  },
  fr: {
    default: 'Source',
    exchange: 'Bourse',
    filing: 'Publication',
    news: 'Actualités',
    research: 'Recherche',
    quote: 'Cours',
    ir: 'IR',
  },
  ja: {
    default: '出典',
    exchange: '取引所',
    filing: '開示',
    news: 'ニュース',
    research: 'リサーチ',
    quote: '相場',
    ir: 'IR',
  },
  ko: {
    default: '출처',
    exchange: '거래소',
    filing: '공시',
    news: '뉴스',
    research: '리서치',
    quote: '시세',
    ir: 'IR',
  },
  de: {
    default: 'Quelle',
    exchange: 'Börse',
    filing: 'Filing',
    news: 'News',
    research: 'Research',
    quote: 'Kurs',
    ir: 'IR',
  },
}

function normalizeUiLocale(locale) {
  const s = String(locale || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s === 'zh-hant') return 'zh-TW'
  if (s.startsWith('zh')) return 'zh-CN'
  if (s.startsWith('ja')) return 'ja'
  if (s.startsWith('ko')) return 'ko'
  if (s.startsWith('de')) return 'de'
  if (s.startsWith('fr')) return 'fr'
  return 'en'
}

function isZhLocale(locale) {
  const loc = normalizeUiLocale(locale)
  return loc === 'zh-CN' || loc === 'zh-TW'
}

function citePack(locale) {
  const loc = normalizeUiLocale(locale)
  return CITE_LABEL[loc] || CITE_LABEL.en
}

function zhToLocaleReplacementPairs(locale) {
  const L = citePack(locale)
  return ZH_TAG_FIELD.map(([zh, field]) => [zh, L[field] || L.default])
}

const ALL_ZH_CITE_TAGS = new Set(ZH_TAG_FIELD.map(([zh]) => zh))

export function localizeCitationBrackets(text, locale) {
  if (isZhLocale(locale)) return String(text ?? '')
  let t = String(text ?? '')
  if (!t) return t
  for (const [zh, to] of zhToLocaleReplacementPairs(locale)) {
    const esc = zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`\\[${esc}\\]`, 'g'), `[${to}]`)
    t = t.replace(new RegExp(`\\(${esc}\\)`, 'g'), `(${to})`)
    t = t.replace(new RegExp(`（${esc}）`, 'g'), `(${to})`)
  }
  return t
}

export function defaultSourceLabel(locale) {
  return citePack(locale).default
}

function normalizeSourceHostLabel(label, locale) {
  const s = String(label || '').trim()
  if (!s || isZhLocale(locale)) return s
  if (ALL_ZH_CITE_TAGS.has(s)) return defaultSourceLabel(locale)
  return s
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
  if (report.riskReward) report.riskReward = loc(report.riskReward)
  if (report.actionLine) report.actionLine = loc(report.actionLine)
  if (report.peerVsSectorLine) report.peerVsSectorLine = loc(report.peerVsSectorLine)
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
      source: normalizeSourceHostLabel(s.source, locale),
    }))
  }
  return report
}
