/**
 * 将来源统一为 { title, source, date, credibility, url }[]
 * @param {unknown} raw
 */
export function normalizeSourcesList(raw) {
  if (Array.isArray(raw)) {
    return raw
      .filter((x) => x && typeof x === 'object')
      .map((s) => ({
        title: String(s.text || s.title || '').trim(),
        source: String(s.source || s.cite || '').trim(),
        date: String(s.time || s.date || '').trim(),
        credibility: credLevel(s.credibility),
        url: String(s.url || '').trim(),
      }))
  }
  if (typeof raw === 'string' && raw.includes('|')) {
    return parseMarkdownSourcesTable(raw)
  }
  return []
}

function credLevel(c) {
  const x = String(c || '').trim().toLowerCase()
  if (x === '高' || x === 'high') return 'high'
  if (x === '低' || x === 'low') return 'low'
  if (x === '中' || x === 'mid' || x === 'medium') return 'mid'
  return 'other'
}

/** @param {string} md */
function parseMarkdownSourcesTable(md) {
  const lines = String(md || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
  if (lines.length < 2) return []
  const rows = lines.filter((l) => !/^\|[-:\s|]+\|$/.test(l))
  const header = rows[0]
  if (!header) return []
  const dataRows = rows.slice(1)
  return dataRows.map((line) => {
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1)
    const [cite = '', summary = '', time = '', cred = '', url = ''] = cells
    const urlMatch = /https?:\/\/[^\s|)]+/i.exec(line)
    return {
      title: summary || cite,
      source: cite,
      date: time,
      credibility: credLevel(cred),
      url: url || (urlMatch ? urlMatch[0] : ''),
    }
  })
}
