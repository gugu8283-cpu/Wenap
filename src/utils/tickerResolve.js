/** Client-side ticker aliases (mirror lib/priceSanity.cjs). */
const ALIASES = {
  黄金: 'GLD',
  金子: 'GLD',
  GOLD: 'GLD',
  白银: 'SLV',
  SILVER: 'SLV',
  原油: 'USO',
  OIL: 'USO',
  石油: 'USO',
}

export function resolveTickerInput(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const upper = s.toUpperCase().replace(/[^A-Z0-9.-]/g, '')
  if (/^[A-Z][A-Z0-9.-]{0,14}$/.test(upper)) return upper
  const zh = s.replace(/\s+/g, '')
  if (ALIASES[zh]) return ALIASES[zh]
  if (ALIASES[s]) return ALIASES[s]
  return upper || s.toUpperCase()
}
