/**
 * Build core conclusion card from snapshot fields when coreConclusion object is absent.
 */
export function normalizeCoreConclusion(raw, report = {}) {
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
  let ifBull = ''
  let ifBear = ''
  if (bull && Number.isFinite(bull.rangeMin) && Number.isFinite(bull.rangeMax)) {
    ifBull = `符合预期 → 目标 $${bull.rangeMin.toFixed(0)}–$${bull.rangeMax.toFixed(0)}`
  }
  if (bear && Number.isFinite(bear.rangeMin)) {
    ifBear = `不及预期 → 回测约 $${bear.rangeMin.toFixed(0)} 风险`
  }

  const headline = summary || catalyst || outlook
  let action = ''
  if (suggestion || stop) {
    action = [suggestion, stop ? `止损 ${stop}` : ''].filter(Boolean).join('，')
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
