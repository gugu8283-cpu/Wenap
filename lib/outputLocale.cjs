/** Normalize client locale for prompts and UI. */
function normalizeLocale(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s === 'zh-hant') return 'zh-TW';
  if (s.startsWith('zh')) return 'zh-CN';
  if (s.startsWith('ja')) return 'ja';
  if (s.startsWith('ko')) return 'ko';
  if (s.startsWith('de')) return 'de';
  if (s.startsWith('fr')) return 'fr';
  if (s.startsWith('en')) return 'en';
  return 'en';
}

const LABELS = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  fr: 'français',
};

const HORIZON = {
  'zh-CN': { '1m': '1个月', '3m': '3个月', '6m': '6个月', '1y': '1年', '2y': '2年' },
  'zh-TW': { '1m': '1個月', '3m': '3個月', '6m': '6個月', '1y': '1年', '2y': '2年' },
  en: { '1m': '1 month', '3m': '3 months', '6m': '6 months', '1y': '1 year', '2y': '2 years' },
  ja: { '1m': '1か月', '3m': '3か月', '6m': '6か月', '1y': '1年', '2y': '2年' },
  ko: { '1m': '1개월', '3m': '3개월', '6m': '6개월', '1y': '1년', '2y': '2년' },
  de: { '1m': '1 Monat', '3m': '3 Monate', '6m': '6 Monate', '1y': '1 Jahr', '2y': '2 Jahre' },
};

const ASSET = {
  'zh-CN': { stock: '个股', etf: 'ETF', reit: 'REITs', commodity_etf: '商品ETF' },
  'zh-TW': { stock: '個股', etf: 'ETF', reit: 'REITs', commodity_etf: '商品ETF' },
  en: { stock: 'Stock', etf: 'ETF', reit: 'REITs', commodity_etf: 'Commodity ETF' },
  ja: { stock: '個別株', etf: 'ETF', reit: 'REITs', commodity_etf: 'コモディティETF' },
  ko: { stock: '개별주', etf: 'ETF', reit: 'REITs', commodity_etf: '원자재 ETF' },
  de: { stock: 'Aktie', etf: 'ETF', reit: 'REITs', commodity_etf: 'Rohstoff-ETF' },
};

const DIMENSIONS = {
  stock: {
    'zh-CN': ['新闻情绪', '地缘政治', '行业趋势', '宏观经济', '市场情绪', '政策法规'],
    'zh-TW': ['新聞情緒', '地緣政治', '行業趨勢', '宏觀經濟', '市場情緒', '政策法規'],
    en: [
      'News sentiment',
      'Geopolitics',
      'Industry trends',
      'Macroeconomics',
      'Market sentiment',
      'Policy & regulation',
    ],
    ja: ['ニュースセンチメント', '地政学', '業界トレンド', 'マクロ経済', '市場センチメント', '政策・規制'],
    ko: ['뉴스 심리', '지정학', '산업 트렌드', '거시경제', '시장 심리', '정책·규제'],
    de: [
      'Nachrichtenstimmung',
      'Geopolitik',
      'Branchentrends',
      'Makroökonomie',
      'Marktstimmung',
      'Politik & Regulierung',
    ],
  },
  etf: {
    'zh-CN': ['新闻情绪', '地缘政治', '行业趋势', '宏观经济', '市场情绪', '指数编制与重仓股画像'],
    'zh-TW': ['新聞情緒', '地緣政治', '行業趨勢', '宏觀經濟', '市場情緒', '指數編制與重倉股畫像'],
    en: [
      'News sentiment',
      'Geopolitics',
      'Industry trends',
      'Macroeconomics',
      'Market sentiment',
      'Index composition & top holdings',
    ],
    ja: ['ニュースセンチメント', '地政学', '業界トレンド', 'マクロ経済', '市場センチメント', '指数構成・主要銘柄'],
    ko: ['뉴스 심리', '지정학', '산업 트렌드', '거시경제', '시장 심리', '지수 구성·주요 보유'],
    de: [
      'Nachrichtenstimmung',
      'Geopolitik',
      'Branchentrends',
      'Makroökonomie',
      'Marktstimmung',
      'Index & Top-Holdings',
    ],
  },
  reit: {
    'zh-CN': ['新闻情绪', '利率与融资环境', '区域与资产质量', '宏观经济', '市场情绪', '派息与现金流稳定性'],
    'zh-TW': ['新聞情緒', '利率與融資環境', '區域與資產質量', '宏觀經濟', '市場情緒', '派息與現金流穩定性'],
    en: [
      'News sentiment',
      'Rates & funding',
      'Regional asset quality',
      'Macroeconomics',
      'Market sentiment',
      'Dividend & cash flow',
    ],
    ja: ['ニュースセンチメント', '金利・資金調達', '地域・資産品質', 'マクロ経済', '市場センチメント', '配当・キャッシュフロー'],
    ko: ['뉴스 심리', '금리·자금', '지역·자산 품질', '거시경제', '시장 심리', '배당·현금흐름'],
    de: [
      'Nachrichtenstimmung',
      'Zinsen & Finanzierung',
      'Regionale Asset-Qualität',
      'Makroökonomie',
      'Marktstimmung',
      'Dividende & Cashflow',
    ],
  },
  commodity_etf: {
    'zh-CN': ['新闻情绪', '地缘与供应链', '商品基本面', '宏观经济', '市场情绪', '持仓与费率结构'],
    'zh-TW': ['新聞情緒', '地緣與供應鏈', '商品基本面', '宏觀經濟', '市場情緒', '持倉與費率結構'],
    en: [
      'News sentiment',
      'Geopolitics & supply chain',
      'Commodity fundamentals',
      'Macroeconomics',
      'Market sentiment',
      'Holdings & fee structure',
    ],
    ja: ['ニュースセンチメント', '地政学・サプライチェーン', 'コモディティ基本面', 'マクロ経済', '市場センチメント', '保有・費用'],
    ko: ['뉴스 심리', '지정학·공급망', '원자재 펀더멘털', '거시경제', '시장 심리', '보유·수수료'],
    de: [
      'Nachrichtenstimmung',
      'Geopolitik & Lieferkette',
      'Rohstoff-Fundamentaldaten',
      'Makroökonomie',
      'Marktstimmung',
      'Bestände & Gebühren',
    ],
  },
};

const POLICY_DIM = {
  'zh-CN': '政策法规',
  'zh-TW': '政策法規',
  en: 'Policy & regulation',
  ja: '政策・規制',
  ko: '정책·규제',
  de: 'Politik & Regulierung',
};

const INSUFFICIENT = {
  'zh-CN': '数据不足',
  'zh-TW': '資料不足',
  en: 'Insufficient data',
  ja: 'データ不足',
  ko: '데이터 부족',
  de: 'Unzureichende Daten',
};

const DISCLAIMER = {
  'zh-CN': '本分析仅供参考，不构成投资建议。',
  'zh-TW': '本分析僅供參考，不構成投資建議。',
  en: 'For informational purposes only; not investment advice.',
  ja: '本分析は参考情報であり、投資助言ではありません。',
  ko: '본 분석은 참고용이며 투자 조언이 아닙니다.',
  de: 'Nur zur Information; keine Anlageberatung.',
};

function pick(map, locale) {
  const loc = normalizeLocale(locale);
  return map[loc] || map['zh-CN'];
}

function horizonLabel(horizon, locale) {
  const loc = normalizeLocale(locale);
  const m = HORIZON[loc] || HORIZON['zh-CN'];
  return m[horizon] || m['3m'] || horizon;
}

function assetLabel(assetType, locale) {
  const loc = normalizeLocale(locale);
  const m = ASSET[loc] || ASSET['zh-CN'];
  return m[assetType] || m.stock;
}

function expectedDimensionNames(assetType, locale) {
  const loc = normalizeLocale(locale);
  const key =
    assetType === 'reit' || assetType === 'etf' || assetType === 'commodity_etf'
      ? assetType
      : 'stock';
  const table = DIMENSIONS[key] || DIMENSIONS.stock;
  return [...(table[loc] || table['zh-CN'])];
}

function policyDimensionName(locale) {
  return pick(POLICY_DIM, locale);
}

function insufficientDataNote(locale) {
  return pick(INSUFFICIENT, locale);
}

function defaultDisclaimer(locale) {
  return pick(DISCLAIMER, locale);
}

function dimensionJsonSpec(assetType, locale) {
  const loc = normalizeLocale(locale);
  const names = expectedDimensionNames(assetType, loc);
  const nameList = names.map((n) => `「${n}」`).join('、');
  const dim6Mandatory =
    assetType === 'etf' || assetType === 'reit' || assetType === 'commodity_etf';
  const noteCap =
    loc === 'en'
      ? dim6Mandatory
        ? 'note≤48 words, 1–2 hard facts + [cite]; dimension 6 MUST score 15-100; never score 0 for listed funds/REITs'
        : 'note≤48 words, 1–2 hard facts + [cite]; no repeat of summary/other dims; use score=0 only when truly no data (note must say insufficient data)'
      : loc.startsWith('zh')
        ? dim6Mandatory
          ? 'note≤48字、1–2硬事实+角标；第6维必须 15-100 分，禁止对上市基金/REIT 打 0'
          : 'note≤48字、只写1–2个硬事实+角标；禁复述 summary/它维；禁套话；score=0 时 note 仅「数据不足」或空。'
        : dim6Mandatory
          ? 'note≤48 chars; dim 6 score 15-100 required'
          : 'note≤48 chars, 1–2 verifiable facts + [cite]; no repeat; empty if score=0';
  return `Exactly 6 items; name order: ${nameList}; each with score 0-100 and note. ${noteCap}`;
}

function sixthDimensionName(assetType, locale) {
  const names = expectedDimensionNames(assetType, locale);
  return names[5] || '';
}

function dimensionBoundaryPromptBlock(assetType, locale) {
  const loc = normalizeLocale(locale);
  const key =
    assetType === 'reit' || assetType === 'etf' || assetType === 'commodity_etf' ? assetType : 'stock';
  const n = expectedDimensionNames(key, loc);
  const [n1, n2, n3, n4, n5, n6] = n;

  if (key === 'etf') {
    if (loc === 'en') {
      return `【Six dimensions — fixed names, no overlap】
${n1} → recent media, fund flows, analyst views on the ETF
${n2} → country/region conflict, sanctions, cross-border risk (not issuer-specific regulation)
${n3} → benchmark sector/theme trends, index methodology context
${n4} → rates, inflation, GDP, broad equity market
${n5} → ETF premium/discount, volume, relative strength vs benchmark
${n6} → index composition, top holdings/sector weights, concentration, expense ratio & tracking (NOT single-stock policy)`;
    }
    if (loc.startsWith('zh')) {
      return `【六维边界·ETF 固定名称】禁止重叠打分：
${n1} → 基金相关新闻、资金流、分析师对 ETF/指数观点
${n2} → 国家/地区冲突、制裁、跨境风险（非对企业监管）
${n3} → 跟踪指数的行业/主题趋势、编制规则背景
${n4} → 利率、通胀、GDP、整体股市环境
${n5} → 折溢价、成交量、相对基准强弱
${n6} → 指数成分、重仓/行业权重、集中度、费率与跟踪误差（勿写成个股政策法规）`;
    }
    return `【6 dims · ETF】Use fixed names: ${n.join(' | ')}. Dim6 = holdings/index, not policy.`;
  }

  if (key === 'reit') {
    if (loc === 'en') {
      return `【Six dimensions — REIT, fixed names】
${n1} → REIT-related news, ratings, sector sentiment
${n2} → mortgage/cap rates, refinancing, central-bank path, funding spreads
${n3} → portfolio geography, property type, occupancy/credit quality (not generic industry cycles)
${n4} → macro growth, inflation, employment affecting property demand
${n5} → REIT valuation, yield spread vs Treasuries, investor demand
${n6} → dividend yield, payout/FFO coverage, cash-flow stability (not stock buybacks)`;
    }
    if (loc.startsWith('zh')) {
      return `【六维边界·REIT 固定名称】
${n1} → REIT 新闻、评级、板块情绪
${n2} → 利率、再融资、央行路径、融资成本
${n3} → 资产地域、物业类型、出租率/信用质量
${n4} → 宏观增长、通胀、就业对物业需求
${n5} → 估值、相对国债利差、资金偏好
${n6} → 股息率、派息与 FFO/现金流覆盖、分红可持续性`;
    }
    return `【6 dims · REIT】Fixed names: ${n.join(' | ')}.`;
  }

  if (key === 'commodity_etf') {
    if (loc === 'en') {
      return `【Six dimensions — commodity ETF, fixed names】
${n1} → commodity/ETF news, positioning, analyst tone
${n2} → war, sanctions, logistics, producer-country risk
${n3} → supply/demand, inventories, futures curve, spot vs futures
${n4} → USD, rates, global growth impacting commodities
${n5} → fund flows, volatility, roll-yield environment
${n6} → holdings structure (physical vs futures), roll/contango, expense ratio (not equity policy)`;
    }
    if (loc.startsWith('zh')) {
      return `【六维边界·商品ETF 固定名称】
${n1} → 商品/ETF 新闻、持仓报告、市场情绪
${n2} → 战争、制裁、物流、产出国风险
${n3} → 供需、库存、期货曲线、现货基差
${n4} → 美元、利率、全球增长对商品影响
${n5} → 资金流、波动、展期收益环境
${n6} → 实物/期货结构、展期与升贴水、费率（非股票政策维）`;
    }
    return `【6 dims · commodity ETF】Fixed: ${n.join(' | ')}.`;
  }

  if (loc === 'en') {
    return `【Six dimensions — stock, fixed names】
${n1} → recent media, analyst ratings, buzz
${n2} → country-level conflict, war risk, regional supply chains (not corporate regulation)
${n3} → growth, tech cycles, competition in the issuer's industry
${n4} → rates, inflation, GDP, jobs, broad market
${n5} → investor mood, valuation, flows, momentum for this stock
${n6} → government/regulator actions on the company or sector (export controls, AI laws, antitrust, tax, IP); not geopolitics`;
  }
  if (loc === 'ja') {
    return `【6次元·個株】固定名：${n.join('／')}。政策・規制は第6次元のみ。`;
  }
  return `【六维边界·个股 固定名称】禁止重叠：
${n1} → 媒体报道、分析师评级、热度
${n2} → 国家间关系、战争、区域供应链（非企业监管）
${n3} → 行业增长、竞争、技术周期
${n4} → 利率、通胀、GDP、就业、整体市场
${n5} → 估值、资金流向、股价动能
${n6} → 政府/监管对企业或行业的立法、执法、出口管制等；勿与地缘政治混淆`;
}

function policyRegulationScoringGuidance(locale) {
  const loc = normalizeLocale(locale);
  const dim = policyDimensionName(loc);
  const insuf = insufficientDataNote(loc);
  if (loc === 'en') {
    return `
【${dim} scoring — required】
Score 0–100 from government policies, export controls, antitrust scrutiny, trade restrictions, sector rules, AI/chip regulation, tax/IP enforcement affecting this issuer.
Even if no major new rule is imminent, score the current regulatory backdrop (e.g. US–China chip export controls, EU AI Act, FTC/antitrust attention for large tech).
Never use score 0 unless regulatory exposure is literally zero (extremely rare for listed equities). If any regulatory context exists, minimum score 10.
Use score 0 only when web search finds no verifiable regulatory facts; then set note to "${insuf}" exactly.`;
  }
  if (loc.startsWith('zh')) {
    return `
【${dim} 打分要求】
根据出口管制、反垄断审查、贸易限制、行业监管、AI/芯片监管、税务与知识产权执法等评估政府/监管风险；无重大新规临近时，也要对**当前监管环境**打分（如中美芯片出口管制、欧盟 AI 法案、科技巨头反垄断关注）。
禁止轻易打 0 分；上市公司几乎总有监管暴露，有监管背景时**最低 10 分**。
仅当联网检索仍无任何可核验监管事实时，才 score=0 且 note 仅写「${insuf}」。`;
  }
  return `
【${dim}】政府/监管风险须打分；有监管背景时最低 10。仅完全无事实时 score=0，note="${insuf}"。`;
}

function policyRegulationBlock(locale) {
  const loc = normalizeLocale(locale);
  const dim = policyDimensionName(loc);
  const scoring = policyRegulationScoringGuidance(loc);
  if (loc === 'en') {
    return `
【Dimension 6 · ${dim}】Assess government/regulator risk: export controls, entity lists, AI regulation (EU AI Act, US policy), antitrust, sector rules, tax, IP.
Geopolitics = state vs state; ${dim} = government vs company/sector. JSON dimensions[5].name must be "${dim}".
${scoring}`;
  }
  return `
【第6维·政策法规】评估政府及监管机构对该公司或行业的定向干预风险，包括：出口管制、AI 监管立法、反垄断、行业专项监管、税务政策变化、知识产权保护。
与地缘政治边界：地缘政治=国家 vs 国家；政策法规=政府 vs 企业/行业。JSON 中 dimensions[5].name 必须为「${dim}」。
${scoring}`;
}

function sixthDimensionScoringGuidance(assetType, locale) {
  const loc = normalizeLocale(locale);
  const dim = sixthDimensionName(assetType, loc);
  const insuf = insufficientDataNote(loc);
  if (!dim) return '';

  if (assetType === 'stock') {
    return policyRegulationScoringGuidance(loc);
  }

  if (assetType === 'etf') {
    if (loc === 'en') {
      return `
【Dimension 6 · ${dim} — required】
Web search: top holdings or sector weights, top-10 concentration, index rules, expense ratio / tracking error.
Score 15–100; never 0 for listed ETFs. JSON dimensions[5].name MUST be exactly "${dim}".`;
    }
    if (loc.startsWith('zh')) {
      return `
【第6维·${dim} — 必须打分】
检索重仓/行业权重、集中度、编制规则、费率/跟踪误差；上市 ETF 禁止 0 分。dimensions[5].name 必须为「${dim}」。`;
    }
    return `【Dim6·${dim}】Score 15-100 required.`;
  }

  if (assetType === 'reit') {
    if (loc === 'en') {
      return `
【Dimension 6 · ${dim} — required】
Assess dividend yield, payout ratio vs FFO/AFFO, occupancy-driven cash flow, distribution history.
Score 15–100 for listed REITs; never 0 unless symbol is invalid. JSON dimensions[5].name MUST be "${dim}".`;
    }
    if (loc.startsWith('zh')) {
      return `
【第6维·${dim} — 必须打分】
评估股息率、派息/FFO 覆盖、出租率与现金流、分红历史；上市 REIT 禁止轻易 0 分。name 必须为「${dim}」。`;
    }
    return `【Dim6·${dim}】Dividend/cash-flow score 15-100.`;
  }

  if (assetType === 'commodity_etf') {
    if (loc === 'en') {
      return `
【Dimension 6 · ${dim} — required】
Assess physical vs futures structure, roll yield / contango, expense ratio, tracking vs spot commodity.
Score 15–100; never 0 for listed commodity ETFs. JSON dimensions[5].name MUST be "${dim}".`;
    }
    if (loc.startsWith('zh')) {
      return `
【第6维·${dim} — 必须打分】
评估实物/期货结构、展期与升贴水、费率、相对现货跟踪；上市商品 ETF 禁止 0 分。name 必须为「${dim}」。`;
    }
    return `【Dim6·${dim}】Holdings/fee/roll score 15-100.`;
  }

  return '';
}

/** Prompt block for dimension 6 only — stock uses full policy block; funds use scoring guidance. */
function sixthDimensionPromptBlock(assetType, locale) {
  const loc = normalizeLocale(locale);
  if (assetType === 'stock') {
    return policyRegulationBlock(loc);
  }
  const dim = sixthDimensionName(assetType, loc);
  const scoring = sixthDimensionScoringGuidance(assetType, loc);
  if (!scoring) return '';
  if (loc === 'en') {
    return `
【Dimension 6 · ${dim}】${scoring.trim()}`;
  }
  return `
【第6维·${dim}】${scoring.trim()}`;
}

/** @deprecated use sixthDimensionPromptBlock */
function etfSixthDimensionBlock(assetType, locale) {
  return sixthDimensionPromptBlock(assetType, locale);
}

function outputLanguageInstruction(locale) {
  const loc = normalizeLocale(locale);
  const name = LABELS[loc] || LABELS['zh-CN'];
  if (loc === 'en') {
    return `
【CRITICAL · OUTPUT LANGUAGE: English】
- Write ALL user-facing text in English: summary, dimensions[].name, dimensions[].note, detailAnalysis, outlook, supplyChain name/relation, scenarios.trigger, valuationBridge, technicalSnapshot, identityCheck, analystPriceLine, disclaimer, tier-gated fields, etc.
- Do NOT output Chinese (or other languages) sentences when locale is English.
- JSON keys unchanged. signal: BUY | HOLD | SELL only. risk: exactly 高 or 中 or 低 (these three characters only, do not translate).
- Use English dimension names from the spec below.
【CRITICAL · VALID JSON】
- Output ONE parseable JSON object only. No markdown fences, no comments, no trailing commas.
- Inside string values: escape " as \\"; use \\n for line breaks; never put raw unescaped quotes in detailAnalysis or notes.`;
  }
  if (loc === 'ja') {
    return `
【重要・出力言語：日本語】
- summary、dimensions[].note、detailAnalysis、outlook、supplyChain、scenarios.trigger などユーザー向けテキストはすべて日本語。
- 中国語の文は出力しない。JSON キーは英語のまま。signal: BUY | HOLD | SELL。risk は 高 | 中 | 低 のみ（翻訳しない）。
- 次元名は下記スペックの日本語名を使用。`;
  }
  if (loc === 'ko') {
    return `
【중요 · 출력 언어: 한국어】
- summary, dimensions[].note, detailAnalysis, outlook, supplyChain, scenarios.trigger 등 사용자 대면 텍스트는 모두 한국어.
- 중국어 문장 금지. JSON 키는 영문 유지. signal: BUY | HOLD | SELL. risk는 高 | 中 | 低 만 사용(번역 금지).
- 차원 이름은 아래 스펙의 한국어 명칭 사용.`;
  }
  if (loc === 'de') {
    return `
【KRITISCH · AUSGABESPRACHE: Deutsch】
- Alle nutzersichtbaren Texte auf Deutsch: summary, dimensions[].note, detailAnalysis, outlook, supplyChain, scenarios.trigger usw.
- Keine chinesischen Sätze. JSON-Schlüssel unverändert. signal: BUY | HOLD | SELL. risk nur 高 | 中 | 低 (nicht übersetzen).
- Dimensionsnamen aus der Spezifikation unten.`;
  }
  return `
【输出语言】面向用户的文本（summary、dimensions[].name、dimensions[].note、detailAnalysis、outlook、disclaimer、supplyChain 的 name/relation、scenarios 的 trigger 等）必须使用${name}撰写。
JSON 键名不变；signal 仍为 BUY | HOLD | SELL；risk 仍用 高 | 中 | 低 三字（勿译成英文）。`;
}

function researchFooterLine(locale, sourceCount) {
  const loc = normalizeLocale(locale);
  const n = Math.max(0, Number(sourceCount) || 0);
  const hours = Math.min(6, Math.max(1, Math.round(n / 2)));
  if (loc === 'en') {
    return `This report synthesizes ${n} public sources (~${hours}h of manual research saved, estimate).`;
  }
  if (loc === 'ja') {
    return `本分析は公開ソース ${n} 件を統合（手作業の約 ${hours} 時間相当・推定）。`;
  }
  if (loc === 'ko') {
    return `본 분석은 공개 출처 ${n}건을 통합했습니다(수작업 약 ${hours}시간 절약 추정).`;
  }
  if (loc === 'de') {
    return `Diese Analyse fasst ${n} öffentliche Quellen zusammen (~${hours} Std. manuelle Recherche gespart, Schätzung).`;
  }
  if (loc === 'zh-TW') {
    return `本分析整合了 ${n} 個公開來源，約可節省 ${hours} 小時人工梳理（估算）。`;
  }
  return `本分析整合了 ${n} 个公开来源，约可节省 ${hours} 小时人工梳理（估算）。`;
}

function signalDisplayLabel(signal, locale) {
  const u = String(signal || '').toUpperCase();
  const loc = normalizeLocale(locale);
  if (loc === 'en') {
    if (u === 'BUY') return 'Buy';
    if (u === 'SELL') return 'Sell';
    return 'Hold';
  }
  if (loc.startsWith('zh')) {
    if (u === 'BUY') return '买入';
    if (u === 'SELL') return '卖出';
    return '持有';
  }
  if (u === 'BUY') return 'BUY';
  if (u === 'SELL') return 'SELL';
  return 'HOLD';
}

module.exports = {
  normalizeLocale,
  LABELS,
  horizonLabel,
  assetLabel,
  expectedDimensionNames,
  policyDimensionName,
  insufficientDataNote,
  defaultDisclaimer,
  dimensionJsonSpec,
  dimensionBoundaryPromptBlock,
  sixthDimensionName,
  sixthDimensionPromptBlock,
  sixthDimensionScoringGuidance,
  policyRegulationBlock,
  policyRegulationScoringGuidance,
  etfSixthDimensionBlock,
  outputLanguageInstruction,
  researchFooterLine,
  signalDisplayLabel,
};
