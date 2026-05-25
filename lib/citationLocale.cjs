/**
 * Locale-aware source cite labels and bracket normalization for report text.
 */
const { normalizeLocale } = require('./outputLocale.cjs');

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
  'zh-CN': {
    default: '来源',
    exchange: '交易所',
    filing: '披露',
    news: '新闻',
    research: '研报',
    quote: '行情',
    ir: 'IR',
  },
  'zh-TW': {
    default: '來源',
    exchange: '交易所',
    filing: '披露',
    news: '新聞',
    research: '研報',
    quote: '行情',
    ir: 'IR',
  },
};

function citePack(locale) {
  const loc = normalizeLocale(locale);
  return CITE_LABEL[loc] || CITE_LABEL.en;
}

function defaultCiteLabel(locale) {
  return citePack(locale).default;
}

/** @param {object} src @param {string} [locale] */
function guessSourceCite(src, locale = 'zh-CN') {
  const L = citePack(locale);
  const u = String(src?.url || '').trim();
  const low = u.toLowerCase();
  if (/^https?:\/\//i.test(u)) {
    if (/sec\.gov/.test(low)) return 'SEC';
    if (/nasdaq\.com|nyse\.com|cboe\.com|hkex\.com|sse\.com|szse\.cn/.test(low)) return L.exchange;
    if (/investor\.|ir\.|\/investor|\/investors|shareholder|edf\.google/.test(low)) return L.ir;
    if (/ventureglobal\.com/.test(low)) return L.ir;
    if (/stocktitan\.net/.test(low)) return L.filing;
    if (/finance\.sina|sina\.com\.cn/.test(low)) return L.news;
    if (/wsj\.com|ft\.com|bloomberg|reuters|cnbc|marketwatch|fool\.com/.test(low)) return L.news;
    if (/arxiv|ssrn|doi\.org|researchgate/.test(low)) return L.research;
    if (
      /trefis\.com|fairvaluelabs\.com|simplywall\.st|gurufocus\.com|seekingalpha\.com|tipranks\.com|zacks\.com|morningstar\.com|sentieo\.com/.test(
        low,
      )
    )
      return L.research;
    if (/tradingkey\.com|investing\.com|finviz\.com|barchart\.com|benzinga\.com/.test(low)) return L.news;
    if (/alphavantage\.co/.test(low)) return L.quote;
    if (/yahoo\.|finance\.yahoo/.test(low)) return L.news;
    if (/eastmoney|163\.com|qq\.com\/finance/.test(low)) return L.news;
    return L.default;
  }
  const raw = String(src?.cite || '').trim();
  if (raw.length > 0 && raw.length <= 12 && !/\s/.test(raw)) {
    return localizeSingleCiteLabel(raw, locale);
  }
  return L.default;
}

function localizeSingleCiteLabel(cite, locale) {
  const loc = normalizeLocale(locale);
  if (loc === 'zh-CN' || loc === 'zh-TW') return cite;
  for (const [zh, en] of ZH_BRACKET_TO_EN) {
    if (cite === zh) return en;
  }
  if (/^sec$/i.test(cite)) return 'SEC';
  if (/^ir$/i.test(cite)) return 'IR';
  return cite;
}

function localizeCitationBrackets(text, locale) {
  const loc = normalizeLocale(locale);
  if (loc === 'zh-CN' || loc === 'zh-TW') return String(text || '');
  let t = String(text || '');
  for (const [zh, en] of ZH_BRACKET_TO_EN) {
    const esc = zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\[${esc}\\]`, 'g'), `[${en}]`);
    t = t.replace(new RegExp(`\\(${esc}\\)`, 'g'), `(${en})`);
    t = t.replace(new RegExp(`（${esc}）`, 'g'), `(${en})`);
  }
  return t;
}

const REPORT_TEXT_KEYS = [
  'identityCheck',
  'summary',
  'detailAnalysis',
  'outlook',
  'technicalSnapshot',
  'valuationBridge',
  'riskBlindSpot',
  'leaderInsiderSummary',
  'peerVsSectorLine',
  'riskReward',
  'actionLine',
];

function localizeReportCitations(data, locale) {
  if (!data || typeof data !== 'object') return;
  const loc = normalizeLocale(locale);
  if (loc === 'zh-CN' || loc === 'zh-TW') return;

  for (const k of REPORT_TEXT_KEYS) {
    if (typeof data[k] === 'string') data[k] = localizeCitationBrackets(data[k], locale);
  }

  if (data.actionLineObj && typeof data.actionLineObj === 'object') {
    for (const k of ['suggestion', 'stopLoss', 'catalyst']) {
      if (typeof data.actionLineObj[k] === 'string') {
        data.actionLineObj[k] = localizeCitationBrackets(data.actionLineObj[k], locale);
      }
    }
  }

  if (data.coreConclusion && typeof data.coreConclusion === 'object') {
    for (const k of ['headline', 'ifBull', 'ifBear', 'action', 'bullCase', 'bearCase']) {
      if (typeof data.coreConclusion[k] === 'string') {
        data.coreConclusion[k] = localizeCitationBrackets(data.coreConclusion[k], locale);
      }
    }
  }

  const dims = Array.isArray(data.dimensions) ? data.dimensions : [];
  for (const d of dims) {
    if (d && typeof d.note === 'string') d.note = localizeCitationBrackets(d.note, locale);
  }

  if (data.scenarios && typeof data.scenarios === 'object') {
    for (const k of ['bull', 'base', 'bear']) {
      const z = data.scenarios[k];
      if (!z || typeof z !== 'object') continue;
      if (typeof z.trigger === 'string') z.trigger = localizeCitationBrackets(z.trigger, locale);
      if (typeof z.range === 'string') z.range = localizeCitationBrackets(z.range, locale);
    }
  }

  const chain = Array.isArray(data.supplyChain) ? data.supplyChain : [];
  for (const c of chain) {
    if (!c || typeof c !== 'object') continue;
    if (typeof c.reason === 'string') c.reason = localizeCitationBrackets(c.reason, locale);
    if (typeof c.relation === 'string') c.relation = localizeCitationBrackets(c.relation, locale);
    if (typeof c.analysis === 'string') c.analysis = localizeCitationBrackets(c.analysis, locale);
  }

  if (data.secondPassCritique && typeof data.secondPassCritique === 'object') {
    const sp = data.secondPassCritique;
    if (typeof sp.blindSpot === 'string') sp.blindSpot = localizeCitationBrackets(sp.blindSpot, locale);
    if (Array.isArray(sp.weaknesses)) {
      sp.weaknesses = sp.weaknesses.map((w) => localizeCitationBrackets(w, locale));
    }
  }

  const arr = Array.isArray(data.sources) ? data.sources : [];
  data.sources = arr.map((s) => {
    if (!s || typeof s !== 'object') return s;
    const cite = localizeSingleCiteLabel(String(s.cite || guessSourceCite(s, locale)).trim(), locale);
    const text =
      typeof s.text === 'string' ? localizeCitationBrackets(s.text, locale) : s.text;
    return { ...s, cite: cite || defaultCiteLabel(locale), text };
  });
}

module.exports = {
  defaultCiteLabel,
  guessSourceCite,
  localizeCitationBrackets,
  localizeSingleCiteLabel,
  localizeReportCitations,
};
