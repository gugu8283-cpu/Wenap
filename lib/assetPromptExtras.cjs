/**
 * Asset-type-specific LLM prompt blocks (crypto, forex, commodities).
 */

function alternativeAssetSystemBlock(assetType, locale) {
  const at = String(assetType || '').trim().toLowerCase();
  const loc = String(locale || 'en');
  const zh = loc.startsWith('zh');

  if (at === 'crypto') {
    if (zh) {
      return `
【加密货币分析】考虑：链上指标、交易所资金流、市场情绪、监管环境、比特币主导率相关性、宏观 risk-off/risk-on。
六维第3维固定为「链上活动」视角（替代行业趋势），勿写成股票行业周期。`;
    }
    return `
【Cryptocurrency analysis】Consider: on-chain metrics, exchange flows, market sentiment, regulatory environment, Bitcoin dominance correlation, and macro risk-off/risk-on.
Dimension 3 must reflect on-chain activity (not equity industry cycles).`;
  }

  if (at === 'forex') {
    if (zh) {
      return `
【外汇分析】考虑：利差、央行政策分化、经济数据日历、地缘政治、关键技术位。
六维第3维固定为「利差」视角（替代行业趋势）。`;
    }
    return `
【Forex pair analysis】Consider: interest rate differentials, central bank policy divergence, economic data calendar, geopolitics, and technical levels.
Dimension 3 must reflect interest rate differential (not industry trends).`;
  }

  if (at === 'commodities') {
    if (zh) {
      return `
【大宗商品现货分析】考虑：供需基本面、地缘供应风险、美元强弱、通胀预期、季节性。
六维第3维固定为「供需平衡」视角（替代行业趋势）。`;
    }
    return `
【Commodity spot analysis】Consider: supply/demand fundamentals, geopolitical supply risks, USD strength, inflation expectations, and seasonality.
Dimension 3 must reflect supply/demand balance (not industry trends).`;
  }

  return '';
}

function supplyChainPromptBlock(assetType, ticker, locale) {
  const at = String(assetType || '').trim().toLowerCase();
  const sym = String(ticker || '').toUpperCase();
  const loc = String(locale || 'en');
  const zh = loc.startsWith('zh');

  if (at === 'crypto') {
    if (zh) {
      return `
【生态关联 supplyChain】至少 2 项；ticker 必填（相关协议/交易所/L2/竞争链代币代码）。
relation 描述与 ${sym} 的生态关系（10–20字）：如 ETH「L2 扩容生态核心资产」、SOL「高性能公链竞争者」。
禁止占位「待补充」「暂无」。`;
    }
    return `
【Ecosystem supplyChain】≥2 items; ticker required (related protocols, exchanges, L2s, competing chains).
relation: 10–20 words on linkage to ${sym} (e.g. ETH "Core L2 scaling ecosystem asset"). No placeholders.`;
  }

  if (at === 'forex') {
    if (zh) {
      return `
【关键驱动 supplyChain】至少 2 项；ticker 填相关货币对或宏观代理（如 DXY、EURUSD、US10Y 代理 ETF）。
relation 描述与 ${sym} 的驱动关系：央行、相关货币对、关键经济指标。`;
    }
    return `
【Key drivers supplyChain】≥2 items; tickers = correlated pairs or macro proxies (e.g. DXY, related FX pairs).
relation: central banks, correlated pairs, or key indicators driving ${sym}.`;
  }

  if (at === 'commodities') {
    if (zh) {
      return `
【市场结构 supplyChain】至少 2 项；ticker 填主要生产商、商品 ETF 代理或相关资产（如 GLD、USO、XLE）。
relation 描述与 ${sym} 现货的产业链/替代/相关关系。`;
    }
    return `
【Market structure supplyChain】≥2 items; tickers = major producers, commodity ETF proxies, or correlated assets.
relation: producers, ETF proxies, or correlated assets vs ${sym} spot.`;
  }

  if (zh) {
    return `
【supplyChain·relation】每项 relation 必须描述该标的与 ${sym} 的具体上下游关系，10–20字，实质性内容。严禁占位。`;
  }
  return `
【supplyChain.relation】10–20 words describing concrete link to ${sym}. No placeholders.`;
}

function supplyChainSectionKey(assetType) {
  const at = String(assetType || '').trim().toLowerCase();
  if (at === 'crypto') return 'report.supplyChainEcosystem';
  if (at === 'forex') return 'report.supplyChainDrivers';
  if (at === 'commodities') return 'report.supplyChainMarket';
  return 'report.supplyChain';
}

module.exports = {
  alternativeAssetSystemBlock,
  supplyChainPromptBlock,
  supplyChainSectionKey,
};
