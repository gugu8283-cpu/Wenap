/**
 * Merge main-report skeptic fields with Pro+ second-pass critique for UI.
 */
export function buildCritiquePayload(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const blindSpot = String(snapshot.riskBlindSpot || '').trim()
  const angles = Array.isArray(snapshot.criticAngles)
    ? snapshot.criticAngles.map((s) => String(s || '').trim()).filter(Boolean)
    : []
  const second = snapshot.secondPassCritique?.weaknesses
  const fromSecond = Array.isArray(second)
    ? second.map((s) => String(s || '').trim()).filter(Boolean)
    : []
  const weaknesses = [...angles, ...fromSecond]
  if (!blindSpot && !weaknesses.length) return null
  return { blindSpot, weaknesses }
}
