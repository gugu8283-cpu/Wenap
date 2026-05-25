import { COLORS, scoreHue } from '../constants/colors.js'
import { normalizeCoreConclusion, parseKeyLevelsFromSnapshot } from './buildCoreConclusion.js'

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

function parseMoneyToken(raw) {
  const n = parseFloat(String(raw || '').replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : NaN
}

function parsePricesFromLine(line, latestUsd) {
  let current = Number.isFinite(latestUsd) && latestUsd > 0 ? latestUsd : NaN
  let target = NaN
  const t = String(line || '')

  const curPatterns = [
    /当前价[^$￥¥0-9]*[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    /现价[^$￥¥0-9]*[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    /current\s*(?:price)?[^$0-9]*\$?\s*([\d,]+(?:\.\d+)?)/i,
    /(?:at|@)\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
  ]
  const quoteLocked = Number.isFinite(latestUsd) && latestUsd > 0
  if (!quoteLocked) {
    for (const re of curPatterns) {
      const m = t.match(re)
      if (m) {
        const v = parseMoneyToken(m[1])
        if (Number.isFinite(v)) {
          current = v
          break
        }
      }
    }
  }

  const tgtPatterns = [
    /目标价[^$￥¥0-9]*[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    /target\s*(?:price)?[^$0-9]*\$?\s*([\d,]+(?:\.\d+)?)/i,
  ]
  for (const re of tgtPatterns) {
    const m = t.match(re)
    if (m) {
      const v = parseMoneyToken(m[1])
      if (Number.isFinite(v)) {
        target = v
        break
      }
    }
  }

  if (!Number.isFinite(target)) {
    const nums = [...t.matchAll(/[$￥¥]?\s*([\d,]+(?:\.\d+)?)/g)]
      .map((m) => parseMoneyToken(m[1]))
      .filter((n) => Number.isFinite(n))
    if (nums.length >= 2) {
      const uniq = [...new Set(nums)]
      if (Number.isFinite(current)) {
        const others = uniq.filter((n) => Math.abs(n - current) > 0.01)
        if (others.length) target = others[others.length - 1]
      } else {
        current = uniq[0]
        target = uniq[uniq.length - 1]
      }
    } else if (nums.length === 1 && !Number.isFinite(current)) {
      current = nums[0]
    }
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
  const latest =
    Number.isFinite(snapshot.latestPriceUsd) && snapshot.latestPriceUsd > 0
      ? snapshot.latestPriceUsd
      : NaN
  let { current, target, upside } = parsePricesFromLine(snapshot.analystPriceLine, latest)
  const currentPrice = Number.isFinite(latest) ? latest : current

  const dims = snapshot.dimensions.slice(0, 6).map((d) => {
    const raw = Number(d.score)
    const unavailable =
      Boolean(d.scoreUnavailable) || !Number.isFinite(raw) || raw === 0
    const sc = unavailable ? null : Math.min(100, Math.max(0, raw))
    const { hex } = scoreHue(unavailable ? 50 : sc)
    return {
      name: String(d.name || '—'),
      score: sc,
      scoreUnavailable: unavailable,
      reason: String(d.note || '').trim(),
      color: unavailable ? '#6b7280' : hex,
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

  const sig = String(snapshot.signal || '').toLowerCase()
  const bullSc = scenarios.find((s) => s.type === 'bull')
  if (
    Number.isFinite(currentPrice) &&
    Number.isFinite(target) &&
    bullSc &&
    Number.isFinite(bullSc.rangeMax)
  ) {
    const ratio = target / currentPrice
    const needsFix =
      (sig === 'buy' && ratio < 0.88) ||
      ratio < 0.25 ||
      ratio > 2.8 ||
      (target < 20 && currentPrice > 50)
    if (needsFix) {
      target = bullSc.rangeMax
      if (currentPrice > 0) {
        upside = Math.round(((target - currentPrice) / currentPrice) * 100)
      }
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

  const coreConclusion = normalizeCoreConclusion(snapshot.coreConclusion, {
    summary: String(snapshot.summary || '').trim(),
    forecast: String(snapshot.outlook || '').trim(),
    actionLineObj:
      snapshot.actionLineObj && typeof snapshot.actionLineObj === 'object'
        ? snapshot.actionLineObj
        : {},
    scenarios: scenariosWithDetail.length ? scenariosWithDetail : scenarios,
  })
  const keyLevels = parseKeyLevelsFromSnapshot(snapshot)

  return {
    ticker,
    name,
    exchange,
    generatedAt: meta.startedAt || new Date().toISOString(),
    dataAsOf: String(snapshot.dataAsOf || '').trim() || '—',
    quoteAsOf: String(snapshot.quoteAsOf || snapshot.dataAsOf || '').trim() || '—',
    freshnessScore: Number.isFinite(Number(snapshot.freshnessScore)) ? Number(snapshot.freshnessScore) : null,
    trustWarnings: Array.isArray(snapshot.trustWarnings) ? snapshot.trustWarnings : [],
    score: Math.min(100, Math.max(0, Number(snapshot.score) || 0)),
    tendency: signalToTendency(snapshot.signal),
    risk: String(snapshot.risk || '—'),
    riskReward: String(snapshot.riskReward || '').trim(),
    currentPrice,
    targetPrice: target,
    upside,
    summary: String(snapshot.summary || '').trim(),
    coreConclusion,
    keyLevels,
    riskBlindSpot: String(snapshot.riskBlindSpot || '').trim(),
    technicalSnapshot: String(snapshot.technicalSnapshot || '').trim(),
    dimensions: dims,
    scenarios: scenariosWithDetail.length ? scenariosWithDetail : scenarios,
    supplyChain,
    forecast: String(snapshot.outlook || '').trim(),
    forecastAssumption: String(snapshot.valuationBridge || snapshot.detailAnalysisPreview || '').trim(),
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
    secondPassCritique: snapshot.secondPassCritique || null,
  }
}

export { COLORS }
