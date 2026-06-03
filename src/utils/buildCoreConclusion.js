/**
 * Build core conclusion card from snapshot fields when coreConclusion object is absent.
 * @param {object} [raw]
 * @param {object} [report]
 * @param {string} [locale]
 */
export function normalizeCoreConclusion(raw, report = {}, locale = 'en') {
  if (raw && typeof raw === 'object') {
    const headline = String(raw.headline || '').trim()
    const ifBull = String(raw.ifBull || raw.bullCase || '').trim()
    const ifBear = String(raw.ifBear || raw.bearCase || '').trim()
    const action = String(raw.action || '').trim()
    if (headline || ifBull || ifBear || action) {
      return { headline, ifBull, ifBear, action }
    }
  }

  const summary = String(report.summary || '').trim()
  const outlook = String(report.forecast || '').trim()
  const catalyst = String(report.actionLineObj?.catalyst || '').trim()
  const suggestion = String(report.actionLineObj?.suggestion || '').trim()
  const stop = String(report.actionLineObj?.stopLoss || '').trim()

  const bull = report.scenarios?.find((s) => s.type === 'bull')
  const bear = report.scenarios?.find((s) => s.type === 'bear')
  const loc = String(locale || 'en').toLowerCase().replace(/_/g, '-')
  const isZh = loc.startsWith('zh')
  const isJa = loc.startsWith('ja')
  const isKo = loc.startsWith('ko')
  const isDe = loc.startsWith('de')
  let ifBull = ''
  let ifBear = ''
  if (bull && Number.isFinite(bull.rangeMin) && Number.isFinite(bull.rangeMax)) {
    if (isZh) ifBull = `符合预期 → 目标 $${bull.rangeMin.toFixed(0)}–$${bull.rangeMax.toFixed(0)}`
    else if (isJa) ifBull = `想定どおり → 目標 $${bull.rangeMin.toFixed(0)}–$${bull.rangeMax.toFixed(0)}`
    else if (isKo) ifBull = `기대 시 → 목표 $${bull.rangeMin.toFixed(0)}–$${bull.rangeMax.toFixed(0)}`
    else if (isDe) ifBull = `Bei Erfüllung → Ziel $${bull.rangeMin.toFixed(0)}–$${bull.rangeMax.toFixed(0)}`
    else ifBull = `If bull case → target $${bull.rangeMin.toFixed(0)}–$${bull.rangeMax.toFixed(0)}`
  }
  if (bear && Number.isFinite(bear.rangeMin)) {
    if (isZh) ifBear = `不及预期 → 回测约 $${bear.rangeMin.toFixed(0)} 风险`
    else if (isJa) ifBear = `下振れ → $${bear.rangeMin.toFixed(0)} 付近の下档リスク`
    else if (isKo) ifBear = `부진 시 → $${bear.rangeMin.toFixed(0)} 부근 하방 리스크`
    else if (isDe) ifBear = `Bei Enttäuschung → Risiko Richtung ~$${bear.rangeMin.toFixed(0)}`
    else ifBear = `If bear case → downside toward ~$${bear.rangeMin.toFixed(0)}`
  }

  const headline = summary || catalyst || outlook
  let action = ''
  if (suggestion || stop) {
    if (isZh) action = [suggestion, stop ? `止损 ${stop}` : ''].filter(Boolean).join('，')
    else if (isJa) action = [suggestion, stop ? `損切 ${stop}` : ''].filter(Boolean).join(' / ')
    else if (isKo) action = [suggestion, stop ? `손절 ${stop}` : ''].filter(Boolean).join(' · ')
    else if (isDe) action = [suggestion, stop ? (stop.toLowerCase().includes('stop') ? stop : `Stop ${stop}`) : ''].filter(Boolean).join(' · ')
    else action = [suggestion, stop ? (stop.toLowerCase().includes('stop') ? stop : `Stop ${stop}`) : ''].filter(Boolean).join(' · ')
  }

  if (!headline && !ifBull && !ifBear && !action) return null
  return {
    headline: headline || '—',
    ifBull,
    ifBear,
    action,
  }
}

export function parseKeyLevelsFromSnapshot(snapshot) {
  const arr = Array.isArray(snapshot?.keyLevels) ? snapshot.keyLevels : []
  const out = []
  for (const item of arr) {
    const price = Number(item?.price)
    const label = String(item?.label || item?.source || '').trim()
    if (Number.isFinite(price) && price > 0 && label) out.push({ price, label })
  }
  if (out.length) return out.slice(0, 4)

  const tech = String(snapshot?.technicalSnapshot || '')
  const re = /[$￥¥]?\s*([\d,]+(?:\.\d+)?)\s*[（(]([^）)]+)[）)]/g
  let m
  while ((m = re.exec(tech)) && out.length < 4) {
    const price = parseFloat(String(m[1]).replace(/,/g, ''))
    const label = String(m[2] || '').trim()
    if (Number.isFinite(price) && price > 0 && label) out.push({ price, label })
  }
  return out
}
