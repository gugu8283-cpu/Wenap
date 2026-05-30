/**
 * Pro+ two-pass hybrid analysis: Haiku (scores, bull/bear, critic) + Flash Lite (rest).
 */

const { extractJsonObject } = require('./parseModelJson.cjs');
const {
  normalizeLocale,
  outputLanguageInstruction,
  horizonLabel,
  assetLabel,
  dimensionJsonSpec,
  dimensionBoundaryPromptBlock,
  sixthDimensionPromptBlock,
  defaultDisclaimer,
} = require('./outputLocale.cjs');
const {
  searchIntegrityBlock,
  sourceFreshnessBlock,
  accuracyTrustPromptBlock,
  dataFreshnessPromptBlock,
} = require('./promptSearchRules.cjs');
const { timeAnchorPromptBlock } = require('./reportTimeAnchor.cjs');
const { stockPricePromptBlock, etfSharePricePromptBlock } = require('./priceSanity.cjs');
const { currentPricePromptBlock } = require('./alphaMarketSnapshot.cjs');
const { alternativeAssetSystemBlock } = require('./assetPromptExtras.cjs');

function proPlusHybridEnabled() {
  const v = String(process.env.WENAP_PRO_PLUS_HYBRID ?? '1')
    .trim()
    .toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'no';
}

function normalizeCriticAngles(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 2);
}

function normalizeSecondPassCritique(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const weaknesses = Array.isArray(raw.weaknesses)
    ? raw.weaknesses.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!weaknesses.length) return null;
  return { weaknesses };
}

function mergeOpenRouterUsage(a, b) {
  if (!a && !b) return null;
  if (!a) return b && typeof b === 'object' ? { ...b } : null;
  if (!b) return a && typeof a === 'object' ? { ...a } : null;
  const inp =
    (Number(a.prompt_tokens) || 0) + (Number(b.prompt_tokens) || 0);
  const out =
    (Number(a.completion_tokens) || 0) + (Number(b.completion_tokens) || 0);
  const total = (Number(a.total_tokens) || 0) + (Number(b.total_tokens) || 0);
  return {
    prompt_tokens: inp,
    completion_tokens: out,
    total_tokens: total || inp + out,
  };
}

function scenarioCurrencyPromptBlock(listingCurrency, exchangeHint, zh) {
  const ex = String(exchangeHint || '').trim();
  const exLine = ex ? (zh ? `\n交易所字段（参考）：${ex}` : `\nExchange field (reference): ${ex}`) : '';
  if (listingCurrency === 'JPY') {
    return zh
      ? `【报价货币】日元上市。${exLine} scenarios 区间用日元，勿用美元 $。`
      : `【Quote currency】JPY listing.${exLine} Use yen in scenario ranges, not USD $.`;
  }
  if (listingCurrency === 'USD') {
    return zh
      ? `【报价货币】美元。${exLine}`
      : `【Quote currency】USD.${exLine}`;
  }
  return zh
    ? `【报价货币】${listingCurrency}。${exLine} 区间与现价货币一致。`
    : `【Quote currency】${listingCurrency}.${exLine} Match listing currency in ranges.`;
}

function horizonWeightHint(horizon, zh) {
  if (horizon === '1m' || horizon === '3m') {
    return zh
      ? '期限较短：新闻情绪、市场情绪、政策/监管权重更高。'
      : 'Short horizon: weight news, sentiment, and policy/regulation higher.';
  }
  if (horizon === '6m' || horizon === '1y' || horizon === '2y') {
    return zh
      ? '期限较长：宏观与行业趋势权重更高。'
      : 'Longer horizon: weight macro and industry trends higher.';
  }
  return '';
}

function formatLockedDimensionsBlock(dimensions, zh) {
  const arr = Array.isArray(dimensions) ? dimensions.slice(0, 6) : [];
  if (!arr.length) return zh ? '（六维尚未提供）' : '(no dimension scores provided)';
  return arr
    .map((d, i) => {
      const name = String(d?.name || `Dim ${i + 1}`).trim();
      const score = d?.scoreUnavailable ? 'N/A' : Number(d?.score);
      const sc = Number.isFinite(score) ? score : 'N/A';
      const note = String(d?.note || '').trim().slice(0, 80);
      return zh
        ? `- ${name}: ${sc}${note ? ` — ${note}` : ''}`
        : `- ${name}: ${sc}${note ? ` — ${note}` : ''}`;
    })
    .join('\n');
}

function buildSharedContext(ctx) {
  const {
    ticker,
    assetType,
    horizon,
    alphaContextBlock,
    listingCurrency,
    exchangeHint,
    locale,
    riskFocus,
    dataAsOfAnchor,
    currentPrice,
    pricePromptBlock,
  } = ctx;
  const loc = normalizeLocale(locale);
  const zh = loc.startsWith('zh');
  const h = horizonLabel(horizon, loc);
  const a = assetLabel(assetType, loc);
  const anchor =
    String(dataAsOfAnchor || '').trim() ||
    new Date().toLocaleDateString(zh ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  const av = alphaContextBlock ? `${alphaContextBlock}\n\n` : '';
  const priceBlock =
    pricePromptBlock ||
    (Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPricePromptBlock(currentPrice, listingCurrency || 'USD', loc)
      : '');
  return {
    loc,
    zh,
    langBlock: outputLanguageInstruction(loc),
    header: zh
      ? `标的 ${ticker} · ${a} · ${h} · ${anchor}`
      : `Ticker ${ticker} · ${a} · horizon ${h} · as of ${anchor}`,
    hw: horizonWeightHint(horizon, zh),
    curBlock: scenarioCurrencyPromptBlock(listingCurrency || 'USD', exchangeHint || '', zh),
    av,
    priceBlock,
    altAssetBlock: alternativeAssetSystemBlock(assetType, loc),
    sixthDimBlock: sixthDimensionPromptBlock(assetType, loc),
    dimBoundary: dimensionBoundaryPromptBlock(assetType, loc),
    dimSpec: dimensionJsonSpec(assetType, loc),
    searchBlocks: `${searchIntegrityBlock(loc)}\n${sourceFreshnessBlock(loc)}\n${accuracyTrustPromptBlock(loc)}\n${timeAnchorPromptBlock(loc)}`,
    dataFresh: dataFreshnessPromptBlock(loc),
    etfStockPrice:
      (assetType === 'stock' ? stockPricePromptBlock(ticker, loc) : '') +
      etfSharePricePromptBlock(assetType, ticker, loc),
    spotLine:
      Number.isFinite(currentPrice) && currentPrice > 0
        ? zh
          ? `【锁定现价】${currentPrice} ${listingCurrency || 'USD'}（Pass 2 必须一致，勿改写）`
          : `【Locked spot】${currentPrice} ${listingCurrency || 'USD'} (Pass 2 must not contradict)`
        : '',
    riskFocusLine: riskFocus ? String(riskFocus) : '',
  };
}

function buildProPlusPass1Prompt(ctx) {
  const c = buildSharedContext(ctx);
  const disc = defaultDisclaimer(c.loc).replace(/"/g, '\\"');

  if (c.zh) {
    return `${c.langBlock}
你是专业股票分析师（Pro+ Pass 1）。须联网核验。只输出一个合法 JSON，禁止 Markdown 围栏。

${c.header}
${c.hw}
${c.curBlock}

${c.av}${c.priceBlock}
${c.dataFresh}
${c.altAssetBlock}
${c.dimBoundary}
${c.sixthDimBlock}
${c.searchBlocks}

【Pass 1 任务】仅输出：六维评分、总分/信号、多空对撞、批评家视角。勿写情景/产业链/核心结论长文。

【评分一致性】score = 六维有效分四舍五入平均（忽略 score=0/不足维），偏差≤3；signal：BUY≥58，HOLD 42-57，SELL≤41。

JSON：
{
  "identityCheck": "≤28字",
  "dataAsOf": "YYYY-MM-DD",
  "score": 0-100,
  "signal": "BUY" | "HOLD" | "SELL",
  "risk": "高" | "中" | "低",
  "riskReward": "如 1:2.5；无法估计留空",
  "analystPriceLine": "单行目标价/现价/空间%（现价须与行情一致）",
  "dimensions": [ ${c.dimSpec} ],
  "bullBearDebate": {
    "bull": [ { "reason": "完整句≤72字", "weight": "如60%" }, ...3条 ],
    "bear": [ { "reason": "完整句≤72字", "weight": "如40%" }, ...3条 ]
  },
  "riskBlindSpot": "≤48字：1条低估风险+日期角标",
  "criticAngles": [ "≤32字怀疑视角1", "≤32字怀疑视角2" ],
  "secondPassCritique": { "weaknesses": [ "≤1句弱点1", "≤1句弱点2", "≤1句弱点3" ] },
  "disclaimer": "${disc}"
}

${outputLanguageInstruction(c.loc)}`;
  }

  return `${c.langBlock}
You are a professional equity analyst (Pro+ Pass 1). Use web search. Output ONE valid JSON only.

${c.header}
${c.hw}
${c.curBlock}

${c.av}${c.priceBlock}
${c.dataFresh}
${c.altAssetBlock}
${c.dimBoundary}
${c.sixthDimBlock}
${c.searchBlocks}

【Pass 1 scope ONLY】Six dimension scores, headline score/signal, bullBearDebate, critic fields. Do NOT write scenarios, supply chain, or long core narrative.

【Score consistency】score = rounded avg of six dims (ignore 0/insufficient); signal BUY≥58, HOLD 42-57, SELL≤41.

JSON:
{
  "identityCheck": "≤28 words",
  "dataAsOf": "YYYY-MM-DD",
  "score": 0-100,
  "signal": "BUY" | "HOLD" | "SELL",
  "risk": "高" | "中" | "低",
  "riskReward": "e.g. 1:2.5 or empty",
  "analystPriceLine": "target / spot / upside % (spot must match quote)",
  "dimensions": [ ${c.dimSpec} ],
  "bullBearDebate": {
    "bull": [ { "reason": "≤120 words", "weight": "e.g. 60%" }, ...3 ],
    "bear": [ { "reason": "≤120 words", "weight": "e.g. 40%" }, ...3 ]
  },
  "riskBlindSpot": "≤48 words with source date tag",
  "criticAngles": [ "≤32 words skeptic #1", "≤32 words skeptic #2" ],
  "secondPassCritique": { "weaknesses": [ "weakness 1", "weakness 2", "weakness 3" ] },
  "disclaimer": "${disc}"
}

${outputLanguageInstruction(c.loc)}`;
}

function buildProPlusPass2Prompt(ctx, pass1) {
  const c = buildSharedContext(ctx);
  const p1 = pass1 && typeof pass1 === 'object' ? pass1 : {};
  const lockedDims = formatLockedDimensionsBlock(p1.dimensions, c.zh);
  const signal = String(p1.signal || '').trim();
  const score = Number(p1.score);
  const scoreStr = Number.isFinite(score) ? String(score) : '—';
  const targetLine = String(p1.analystPriceLine || '').trim();
  const disc = defaultDisclaimer(c.loc).replace(/"/g, '\\"');

  const lockedBlock = c.zh
    ? `【已锁定 · 禁止改写】
- 总分 score: ${scoreStr}
- 信号 signal: ${signal || '—'}
- 六维（名称与分数必须原样写入 dimensions 字段，勿重新计算）：
${lockedDims}
${targetLine ? `- 目标价行 analystPriceLine: ${targetLine}` : ''}
${c.spotLine}`
    : `【LOCKED — do not recalculate】
- Headline score: ${scoreStr}
- Signal: ${signal || '—'}
- Six dimensions (copy EXACT scores into your output "dimensions" array):
${lockedDims}
${targetLine ? `- analystPriceLine: ${targetLine}` : ''}
${c.spotLine}`;

  if (c.zh) {
    return `${c.langBlock}
你是股票分析师（Pro+ Pass 2）。基于行情与 Pass 1 锁定分数撰写其余章节。只输出一个合法 JSON。

${c.header}
${c.hw}
${c.curBlock}

${c.av}${c.priceBlock}
${c.dataFresh}
${c.etfStockPrice}
${c.searchBlocks}

${lockedBlock}

【Pass 2 任务】输出：summary、coreConclusion、keyLevels、scenarios、supplyChain、detailAnalysis、sources、technicalSnapshot、outlook、valuationBridge、Pro 字段。dimensions 必须与上方锁定列表完全一致（仅可补 note，不得改 score）。

JSON：
{
  "summary": "≤28字",
  "coreConclusion": {
    "headline": "≤32字",
    "ifBull": "符合预期→目标区间",
    "ifBear": "不及预期→下行",
    "action": "建议+止损"
  },
  "keyLevels": [ { "price": 0, "label": "≤20字" } ],
  "analystPriceLine": "${targetLine ? '与锁定行一致' : '单行目标价/现价'}",
  "dimensions": [ 与锁定六维相同 score，可微调 note ],
  "detailAnalysis": "180-260字",
  "sources": [ { "text": "", "url": "https://...", "time": "", "credibility": "高|中|低", "cite": "SEC" } ],
  "supplyChain": [ { "ticker": "", "name": "", "exchange": "", "relation": "10-20字", "score": 0-100, "analysis": "≤50字" } ],
  "scenarios": {
    "bull": { "p": 0-100, "range": "", "trigger": "≤36字", "triggerPrice": null, "timeWindow": "" },
    "base": { "p": 0-100, "range": "", "trigger": "≤36字", "triggerPrice": null, "timeWindow": "" },
    "bear": { "p": 0-100, "range": "", "trigger": "≤36字", "triggerPrice": null, "timeWindow": "" }
  },
  "valuationBridge": "≤36字",
  "technicalSnapshot": "≤56字",
  "outlook": "≤72字",
  "risk": "高|中|低",
  "riskReward": "",
  "actionLine": { "suggestion": "", "stopLoss": "", "catalyst": "" },
  "keyEvents": [ { "date": "YYYY-MM-DD", "event": "" } ],
  "leaderInsiderSummary": "",
  "peerVsSectorLine": "",
  "disclaimer": "${disc}"
}

硬性：supplyChain≥2；scenarios.p 之和=100；目标价须落在 bull 区间内。

${outputLanguageInstruction(c.loc)}`;
  }

  return `${c.langBlock}
You are an equity analyst (Pro+ Pass 2). Write remaining sections using quote data and Pass 1 locked scores. ONE JSON only.

${c.header}
${c.hw}
${c.curBlock}

${c.av}${c.priceBlock}
${c.dataFresh}
${c.etfStockPrice}
${c.searchBlocks}

${lockedBlock}

【Pass 2 scope】summary, coreConclusion, keyLevels, scenarios, supplyChain, detailAnalysis, sources, technicalSnapshot, outlook, valuationBridge, Pro fields. Copy locked dimension scores exactly.

JSON:
{
  "summary": "≤28 words",
  "coreConclusion": { "headline": "", "ifBull": "", "ifBear": "", "action": "" },
  "keyLevels": [ { "price": 0, "label": "" } ],
  "analystPriceLine": "must align with locked line if provided",
  "dimensions": [ same scores as locked list ],
  "detailAnalysis": "180-260 chars",
  "sources": [ { "text": "", "url": "https://...", "time": "", "credibility": "", "cite": "" } ],
  "supplyChain": [ { "ticker": "", "name": "", "exchange": "", "relation": "", "score": 0, "analysis": "≤50 words" } ],
  "scenarios": {
    "bull": { "p": 0, "range": "", "trigger": "", "triggerPrice": null, "timeWindow": "" },
    "base": { "p": 0, "range": "", "trigger": "", "triggerPrice": null, "timeWindow": "" },
    "bear": { "p": 0, "range": "", "trigger": "", "triggerPrice": null, "timeWindow": "" }
  },
  "valuationBridge": "",
  "technicalSnapshot": "",
  "outlook": "",
  "risk": "",
  "riskReward": "",
  "actionLine": { "suggestion": "", "stopLoss": "", "catalyst": "" },
  "keyEvents": [ { "date": "", "event": "" } ],
  "leaderInsiderSummary": "",
  "peerVsSectorLine": "",
  "disclaimer": "${disc}"
}

Rules: supplyChain≥2; scenario probabilities sum to 100.

${outputLanguageInstruction(c.loc)}`;
}

function mergePass1Dimensions(pass1Dims, pass2Dims) {
  const a1 = Array.isArray(pass1Dims) ? pass1Dims : [];
  const a2 = Array.isArray(pass2Dims) ? pass2Dims : [];
  if (!a1.length) return a2;
  return a1.map((d, i) => {
    const p = d && typeof d === 'object' ? d : {};
    const q = a2[i] && typeof a2[i] === 'object' ? a2[i] : {};
    const note2 = String(q.note || '').trim();
    return {
      ...p,
      name: String(p.name || q.name || '').trim(),
      score: p.score != null ? p.score : q.score,
      scoreUnavailable: Boolean(p.scoreUnavailable ?? q.scoreUnavailable),
      note: note2 || String(p.note || '').trim(),
    };
  });
}

function mergeProPlusHybridReports(pass1, pass2) {
  const p1 = pass1 && typeof pass1 === 'object' ? pass1 : {};
  const p2 = pass2 && typeof pass2 === 'object' ? pass2 : {};
  const dimensions = mergePass1Dimensions(p1.dimensions, p2.dimensions);

  return {
    identityCheck: String(p1.identityCheck || p2.identityCheck || '').trim(),
    dataAsOf: String(p1.dataAsOf || p2.dataAsOf || '').trim(),
    score: p1.score != null ? p1.score : p2.score,
    signal: String(p1.signal || p2.signal || '').trim(),
    risk: String(p1.risk || p2.risk || '').trim(),
    riskReward: String(p1.riskReward || p2.riskReward || '').trim(),
    summary: String(p2.summary || p1.summary || '').trim(),
    coreConclusion: p2.coreConclusion || p1.coreConclusion || null,
    riskBlindSpot: String(p1.riskBlindSpot || '').trim(),
    criticAngles: normalizeCriticAngles(p1.criticAngles),
    secondPassCritique: normalizeSecondPassCritique(p1.secondPassCritique),
    keyLevels: Array.isArray(p2.keyLevels) ? p2.keyLevels : p1.keyLevels || [],
    analystPriceLine: String(p2.analystPriceLine || p1.analystPriceLine || '').trim(),
    dimensions,
    detailAnalysis: String(p2.detailAnalysis || '').trim(),
    sources: Array.isArray(p2.sources) ? p2.sources : [],
    supplyChain: Array.isArray(p2.supplyChain) ? p2.supplyChain : [],
    scenarios: p2.scenarios && typeof p2.scenarios === 'object' ? p2.scenarios : p1.scenarios,
    valuationBridge: String(p2.valuationBridge || '').trim(),
    technicalSnapshot: String(p2.technicalSnapshot || '').trim(),
    outlook: String(p2.outlook || '').trim(),
    disclaimer: String(p2.disclaimer || p1.disclaimer || '').trim(),
    bullBearDebate:
      p1.bullBearDebate && typeof p1.bullBearDebate === 'object' ? p1.bullBearDebate : null,
    actionLine: p2.actionLine || null,
    keyEvents: Array.isArray(p2.keyEvents) ? p2.keyEvents : [],
    leaderInsiderSummary: String(p2.leaderInsiderSummary || '').trim(),
    peerVsSectorLine: String(p2.peerVsSectorLine || '').trim(),
    comparison: p2.comparison ?? null,
  };
}

function normalizePass1Data(raw) {
  const data = raw && typeof raw === 'object' ? { ...raw } : {};
  data.criticAngles = normalizeCriticAngles(data.criticAngles);
  data.secondPassCritique = normalizeSecondPassCritique(data.secondPassCritique);
  return data;
}

/**
 * @param {Function} openRouterChat - (apiKey, opts) => Promise<{ content, usage, modelUsed }>
 */
async function runProPlusHybridAnalysis(openRouterChat, apiKey, ctx, models) {
  const pass1Model = models.pass1;
  const pass2Model = models.pass2;
  const pass1Prompt = buildProPlusPass1Prompt(ctx);
  const pass1Result = await openRouterChat(apiKey, {
    model: pass1Model,
    userContent: pass1Prompt,
    stream: false,
    useWeb: true,
    maxOutputTokens: models.pass1MaxTokens || 2800,
    timeoutMs: 0,
  });
  let pass1Data;
  try {
    pass1Data = normalizePass1Data(extractJsonObject(pass1Result.content));
  } catch (e) {
    const fixPrompt = `Fix the following broken JSON. Return ONLY one valid JSON object, same Pass 1 schema.\n${String(pass1Result.content || '').slice(0, 10000)}`;
    const retry = await openRouterChat(apiKey, {
      model: pass1Model,
      userContent: fixPrompt,
      stream: false,
      useWeb: false,
      maxOutputTokens: models.pass1MaxTokens || 2800,
      timeoutMs: 0,
    });
    const u1 = mergeOpenRouterUsage(pass1Result.usage, retry.usage);
    pass1Result.usage = u1;
    pass1Data = normalizePass1Data(extractJsonObject(retry.content));
  }

  if (!Array.isArray(pass1Data.dimensions) || pass1Data.dimensions.length < 4) {
    throw new Error('Pass 1 missing dimensions');
  }

  const pass2Prompt = buildProPlusPass2Prompt(ctx, pass1Data);
  const pass2Result = await openRouterChat(apiKey, {
    model: pass2Model,
    userContent: pass2Prompt,
    stream: false,
    useWeb: false,
    maxOutputTokens: models.pass2MaxTokens || 3800,
    timeoutMs: 0,
  });
  let pass2Data;
  try {
    pass2Data = extractJsonObject(pass2Result.content);
  } catch (e) {
    const fixPrompt = `Fix the following broken JSON. Return ONLY one valid JSON object, same Pass 2 schema.\n${String(pass2Result.content || '').slice(0, 12000)}`;
    const retry = await openRouterChat(apiKey, {
      model: pass2Model,
      userContent: fixPrompt,
      stream: false,
      useWeb: false,
      maxOutputTokens: models.pass2MaxTokens || 3800,
      timeoutMs: 0,
    });
    pass2Result.usage = mergeOpenRouterUsage(pass2Result.usage, retry.usage);
    pass2Data = extractJsonObject(retry.content);
  }

  const data = mergeProPlusHybridReports(pass1Data, pass2Data);
  data.criticAngles = normalizeCriticAngles(data.criticAngles);

  return {
    data,
    pass1Model: pass1Result.modelUsed || pass1Model,
    pass2Model: pass2Result.modelUsed || pass2Model,
    usage: {
      pass1: pass1Result.usage,
      pass2: pass2Result.usage,
      pass1Model: pass1Result.modelUsed || pass1Model,
      pass2Model: pass2Result.modelUsed || pass2Model,
    },
    modelLabel: `hybrid:${pass1Model}+${pass2Model}`,
  };
}

module.exports = {
  proPlusHybridEnabled,
  buildProPlusPass1Prompt,
  buildProPlusPass2Prompt,
  mergeProPlusHybridReports,
  runProPlusHybridAnalysis,
  mergeOpenRouterUsage,
  normalizeCriticAngles,
};
