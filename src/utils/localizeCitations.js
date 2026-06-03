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

export function normalizeSourceHostLabel(label, locale) {
  const s = String(label || '').trim()
  if (!s || isZhLocale(locale)) return s
  if (ALL_ZH_CITE_TAGS.has(s)) return defaultSourceLabel(locale)
  return s
}

export function localizeRiskCredTokensInText(text, locale) {
  if (isZhLocale(locale)) return String(text ?? '')
  const loc = normalizeUiLocale(locale)
  let t = String(text ?? '')
  if (!t || !/[高中低]/.test(t)) return t

  const risk = (ch) => {
    if (loc === 'de') return ch === '高' ? 'Hoch' : ch === '低' ? 'Niedrig' : 'Mittel'
    if (loc === 'ko') return ch === '高' ? '높음' : ch === '低' ? '낮음' : '중간'
    return ch === '高' ? 'High' : ch === '低' ? 'Low' : 'Medium'
  }

  t = t.replace(/Risk score\s*高/gi, `${risk('高')} risk score`)
  t = t.replace(/Risk score\s*中/gi, `${risk('中')} risk score`)
  t = t.replace(/Risk score\s*低/gi, `${risk('低')} risk score`)
  t = t.replace(/Risk level\s*[:：]\s*高/gi, `Risk level: ${risk('高')}`)
  t = t.replace(/Risk level\s*[:：]\s*中/gi, `Risk level: ${risk('中')}`)
  t = t.replace(/Risk level\s*[:：]\s*低/gi, `Risk level: ${risk('低')}`)
  t = t.replace(/(?<=[\s(,:/]|^)(高|中|低)(?=[\s).,;]|$)/g, (ch) => risk(ch))
  return t
}

function locText(text, locale) {
  return localizeRiskCredTokensInText(localizeCitationBrackets(text, locale), locale)
}

/** @param {import('../types/analysis.js').MobileReport} report */
export function localizeMobileReportCitations(report, locale) {
  if (!report || isZhLocale(locale)) return report
  const loc = (s) => locText(s, locale)
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
  if (report.bullBearDebate && typeof report.bullBearDebate === 'object') {
    const normSide = (arr) =>
      (Array.isArray(arr) ? arr : []).map((x) => ({
        ...x,
        reason: loc(x.reason),
        text: loc(x.text),
      }))
    report.bullBearDebate = {
      bull: normSide(report.bullBearDebate.bull),
      bear: normSide(report.bullBearDebate.bear),
    }
  }
  if (Array.isArray(report.criticAngles)) {
    report.criticAngles = report.criticAngles.map((w) => loc(w))
  }
  return report
}
