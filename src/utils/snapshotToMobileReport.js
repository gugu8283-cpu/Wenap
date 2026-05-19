import { COLORS, scoreHue } from '../constants/colors.js'

function signalToTendency(sig) {
  const u = String(sig || '').toUpperCase()
  if (u === 'BUY') return 'buy'
  if (u === 'SELL') return 'sell'
  return 'hold'
}

function parseCompanyExchange(identityCheck, ticker, companyName = '') {
  const official = String(companyName || '').trim()
  const s = String(identityCheck || '').trim()
  let name = official
  let exchange = '—'
  const m = /^(.+?)\s*\(([A-Za-z.]+)\s*[:：]?\s*([A-Z0-9.-]+)\)/i.exec(s)
  if (m) {
    if (!name) name = m[1].replace(/实体与代码核验[：:]\s*/, '').trim()
    exchange = m[2].toUpperCase()
  } else if (s) {
    const dash = /^(.+?)\s*[-–—]\s*([A-Z0-9.-]+)$/i.exec(s)
    if (dash && !name) name = dash[1].trim()
    else if (!name) name = s.replace(/实体与代码核验[：:]\s*/, '').slice(0, 48).trim()
  }
  if (!name) name = ticker || '—'
  return { name, exchange }
}

function parsePricesFromLine(line, latestUsd) {
  let current = Number.isFinite(latestUsd) && latestUsd > 0 ? latestUsd : NaN
  let target = NaN
  const t = String(line || '')
  const curM = t.match(/当前价[^$￥0-9]*([\d,]+(?:\.\d+)?)|\$?\s*([\d,]+(?:\.\d+)?)\s*与.*目标/)
  if (curM) {
    const v = parseFloat(String(curM[1] || curM[2]).replace(/,/g, ''))
    if (Number.isFinite(v)) current = v
  }
  const tgtM = t.match(/目标价[^$￥0-9]*\$?\s*([\d,]+(?:\.\d+)?)/)
  if (tgtM) {
    const v = parseFloat(tgtM[1].replace(/,/g, ''))
    if (Number.isFinite(v)) target = v
  }
  let upside = NaN
  if (Number.isFinite(current) && Number.isFinite(target) && current > 0) {
    upside = Math.round(((target - current) / current) * 100)
  }
  return { current, target, upside }
}

function parseScenarioRange(rangeStr) {
  const s = String(rangeStr || '')
  const nums = s.match(/[\d,]+(?:\.\d+)?/g)
  if (!nums || nums.length < 2) return { min: NaN, max: NaN }
  const a = parseFloat(nums[0].replace(/,/g, ''))
  const b = parseFloat(nums[1].replace(/,/g, ''))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { min: NaN, max: NaN }
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

function timeSavedFromFooter(line, n) {
  const s = String(line || '')
  const zh = /约可节省\s*(\d+)\s*小时/.exec(s)
  if (zh) return parseInt(zh[1], 10)
  const en = /~(\d+)\s*h/i.exec(s)
  if (en) return parseInt(en[1], 10)
  return Math.min(6, Math.max(1, Math.round(n / 2)))
}

function credToLevel(c) {
  const x = String(c || '').trim().toLowerCase()
  if (x === '高') return 'high'
  if (x === '低') return 'low'
  return 'mid'
}

/**
 * @param {object} snapshot
 * @param {{ ticker?: string, startedAt?: string }} meta
 * @returns {import('../types/analysis.js').MobileReport | null}
 */
export function snapshotToMobileReport(snapshot, meta = {}) {
  if (!snapshot || !Array.isArray(snapshot.dimensions) || !snapshot.dimensions.length) return null

  const ticker = String(meta.ticker || '').toUpperCase() || '—'
  const { name, exchange } = parseCompanyExchange(
    snapshot.identityCheck,
    ticker,
    snapshot.companyName,
  )
  const latest = snapshot.latestPriceUsd
  const { current, target, upside } = parsePricesFromLine(snapshot.analystPriceLine, latest)

  const dims = snapshot.dimensions.slice(0, 6).map((d) => {
    const sc = Math.min(100, Math.max(0, Number(d.score) || 0))
    const { hex } = scoreHue(sc)
    return {
      name: String(d.name || '—'),
      score: sc,
      reason: String(d.note || '').trim(),
      color: hex,
    }
  })

  const scenarios = []
  const sc = snapshot.scenarios
  if (sc && typeof sc === 'object') {
    const rows = [
      ['bull', sc.bull],
      ['base', sc.base],
      ['bear', sc.bear],
    ]
    for (const [type, z] of rows) {
      if (!z || typeof z !== 'object') continue
      const { min, max } = parseScenarioRange(z.range)
      scenarios.push({
        type,
        probability: Math.min(100, Math.max(0, Number(z.p) || 0)),
        rangeMin: min,
        rangeMax: max,
        trigger: String(z.trigger || '').trim(),
      })
    }
  }

  const supplyChain = (Array.isArray(snapshot.supplyChain) ? snapshot.supplyChain : []).map((c) => ({
    code: String(c.ticker || '').toUpperCase(),
    name: String(c.name || '').trim(),
    exchange: String(c.exchange || '—').trim() || '—',
    relation: String(c.relation || c.reason || '').trim(),
    analysis: String(c.analysis || '').trim(),
    score: Math.min(100, Math.max(0, Number(c.score) || 0)),
    analyzeCode: String(c.ticker || '').trim().toUpperCase(),
  }))

  const sources = (Array.isArray(snapshot.sources) ? snapshot.sources : []).map((s) => {
    let host = ''
    try {
      host = new URL(String(s.url || '')).hostname.replace(/^www\./, '')
    } catch {
      host = ''
    }
    return {
      title: String(s.text || '').trim(),
      source: host || '来源',
      date: String(s.time || '').trim(),
      credibility: credToLevel(s.credibility),
      url: String(s.url || '').trim(),
    }
  })

  const srcN = typeof snapshot.sourcesCount === 'number' ? snapshot.sourcesCount : sources.length

  // Tier-gated fields: pass through from snapshot so Pro/Pro+ sections render
  const actionLineObj =
    snapshot.actionLineObj && typeof snapshot.actionLineObj === 'object'
      ? {
          suggestion: String(snapshot.actionLineObj.suggestion || '').trim(),
          stopLoss: String(snapshot.actionLineObj.stopLoss || '').trim(),
          catalyst: String(snapshot.actionLineObj.catalyst || '').trim(),
        }
      : { suggestion: '', stopLoss: '', catalyst: '' }

  const keyEvents = Array.isArray(snapshot.keyEvents)
    ? snapshot.keyEvents.map((e) => ({
        date: String(e.date || '').trim(),
        event: String(e.event || '').trim(),
      }))
    : []

  const bullBearDebate =
    snapshot.bullBearDebate && typeof snapshot.bullBearDebate === 'object'
      ? snapshot.bullBearDebate
      : { bull: [], bear: [] }

  // Add triggerPrice / timeWindow to scenarios for Pro+
  const scenariosWithDetail = []
  const scSnap = snapshot.scenarios
  if (scSnap && typeof scSnap === 'object') {
    const rows = [
      ['bull', scSnap.bull],
      ['base', scSnap.base],
      ['bear', scSnap.bear],
    ]
    for (const [type, z] of rows) {
      if (!z || typeof z !== 'object') continue
      const { min, max } = parseScenarioRange(z.range)
      const found = scenarios.find((s) => s.type === type) || {}
      scenariosWithDetail.push({
        ...found,
        type,
        probability: Math.min(100, Math.max(0, Number(z.p) || 0)),
        rangeMin: min,
        rangeMax: max,
        trigger: String(z.trigger || '').trim(),
        triggerPrice: Number.isFinite(Number(z.triggerPrice)) ? Number(z.triggerPrice) : null,
        timeWindow: String(z.timeWindow || '').trim(),
      })
    }
  }

  return {
    ticker,
    name,
    exchange,
    generatedAt: meta.startedAt || new Date().toISOString(),
    dataAsOf: String(snapshot.dataAsOf || '').trim() || '—',
    score: Math.min(100, Math.max(0, Number(snapshot.score) || 0)),
    tendency: signalToTendency(snapshot.signal),
    risk: String(snapshot.risk || '—'),
    riskReward: String(snapshot.riskReward || '').trim(),
    currentPrice: current,
    targetPrice: target,
    upside,
    summary: String(snapshot.summary || '').trim(),
    technicalSnapshot: String(snapshot.technicalSnapshot || '').trim(),
    dimensions: dims,
    scenarios: scenariosWithDetail.length ? scenariosWithDetail : scenarios,
    supplyChain,
    forecast: String(snapshot.outlook || '').trim(),
    forecastAssumption: String(snapshot.valuationBridge || snapshot.detailAnalysisPreview || '')
      .trim()
      .slice(0, 200),
    sources,
    sourceCount: srcN,
    timeSaved: timeSavedFromFooter(snapshot.researchFooterLine, srcN),
    // Pro fields
    reportTier: String(snapshot.reportTier || 'free'),
    model: String(snapshot.model || '').trim(),
    listingCurrency: String(snapshot.listingCurrency || 'USD'),
    actionLine: String(snapshot.actionLine || '').trim(),
    actionLineObj,
    keyEvents,
    leaderInsiderSummary: String(snapshot.leaderInsiderSummary || '').trim(),
    peerVsSectorLine: String(snapshot.peerVsSectorLine || '').trim(),
    proFieldHints: snapshot.proFieldHints || {},
    // Pro+ fields
    bullBearDebate,
    proPlusFieldHints: snapshot.proPlusFieldHints || {},
  }
}

export { COLORS }
