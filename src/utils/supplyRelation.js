export function isPlaceholderRelation(text) {
  const t = String(text ?? '').trim()
  return t.length === 0
}

/** 仅 null/undefined/空字符串 时显示占位；含「待」「补充」等原文展示便于调试 */
export function formatSupplyRelation(text) {
  const raw = String(text ?? '').trim()
  if (!raw) {
    return { text: '关联分析更新中', placeholder: true }
  }
  return { text: raw, placeholder: false }
}