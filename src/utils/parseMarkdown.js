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
export function renderMarkdownParagraphs(str) {
  const paras = splitParagraphs(str)
  if (!paras.length) return ''
  return paras
}

/** 估值桥接句是否明显未写完（勿展示「数据加载中」占位） */
export function isIncompleteAssumption(text) {
  const t = String(text || '').trim()
  if (!t) return false
  if (/数据加载中/.test(t)) return true
  return /[，,、；;：:]$/.test(t) || (t.length < 12 && /[，,]$/.test(t))
}

export function fixTruncatedAssumption(text) {
  const t = String(text || '').trim()
  if (!t) return ''
  if (isIncompleteAssumption(t)) return ''
  return t
}
