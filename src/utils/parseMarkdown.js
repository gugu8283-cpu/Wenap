/**
 * 轻量 markdown 清理/段落化，供移动端正文展示（不渲染表格）。
 */
export function stripMarkdownInline(str) {
  let t = String(str || '')
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
  t = t.replace(/\*([^*]+)\*/g, '$1')
  t = t.replace(/`([^`]+)`/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return t.trim()
}

/** @returns {string[]} */
export function splitParagraphs(str) {
  const cleaned = stripMarkdownInline(str)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\|.*\|$/gm, '')
    .replace(/^[-|:\s]+$/gm, '')
  return cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
}

/**
 * @param {string} str
 * @returns {import('react').ReactNode[] | string}
 */
export function renderMarkdownParagraphs(str, className = '') {
  const paras = splitParagraphs(str)
  if (!paras.length) return ''
  return paras
}

export function fixTruncatedAssumption(text) {
  const t = String(text || '').trim()
  if (!t) return ''
  if (/[，,、；;]$/.test(t)) return `${t}…（数据加载中）`
  return t
}
