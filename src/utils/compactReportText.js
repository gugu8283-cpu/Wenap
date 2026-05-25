/**
 * Turn long prose into scannable bullets for mobile report UI.
 */

export function splitToBullets(text, maxItems = 5) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const parts = raw
    .split(/\n+|(?<=[。！？.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length <= 1 && raw.length > 120) {
    return raw
      .split(/[;；]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, maxItems)
  }
  return parts.slice(0, maxItems)
}

export function firstSentence(text) {
  const t = String(text || '').trim()
  if (!t) return ''
  const m = t.match(/^[^。！？.!?\n]+[。！？.!?]?/)
  return m ? m[0].trim() : t.slice(0, 160)
}
