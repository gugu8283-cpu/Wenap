/**
 * 设计基准色（Chart.js 等需硬编码处）。
 * 界面主样式用 CSS 变量（theme.css），默认暗色。
 */

/** Wenap 品牌色 */
export const BRAND = {
  primary: '#00D4AA',
  accent: '#B400FF',
  bg: '#080B14',
  bgCard: '#161616',
  bgElevated: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#333333',
}

/** 发光效果 */
export const GLOW = {
  green: '0 0 20px rgba(0,212,170,0.6)',
  purple: '0 0 20px rgba(180,0,255,0.4)',
  greenText: '0 0 24px rgba(0,212,170,0.9), 0 0 48px rgba(0,212,170,0.5)',
}

export const COLORS = {
  primary: '#378ADD',
  success: '#00D4AA',
  warning: '#F5A623',
  danger: '#FF4D4D',
  bgLight: '#F2F2F0',
  bgDark: '#0D0D0D',
  cardLight: '#FFFFFF',
  cardDark: '#161616',
  textMain: '#F0F0F0',
  textMuted: '#888888',
  skeleton: '#242424',
  skeletonHi: '#2E2E2E',
  radarFill: 'rgba(55,138,221,0.18)',
  radarBorder: '#378ADD',
}

export function scoreHue(score) {
  const s = Number(score) || 0
  if (s >= 70) return { key: 'success', hex: COLORS.success, glow: 'var(--glow-green)' }
  if (s >= 40) return { key: 'warning', hex: COLORS.warning, glow: 'var(--glow-amber)' }
  return { key: 'danger', hex: COLORS.danger, glow: 'var(--glow-red)' }
}

export function tendencyColors(tendency) {
  const t = String(tendency || 'hold').toLowerCase()
  if (t === 'buy') return COLORS.success
  if (t === 'sell') return COLORS.danger
  return COLORS.warning
}
