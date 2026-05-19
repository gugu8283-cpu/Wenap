const KEY = 'wenap_theme'
const LEGACY_KEY = 'stockai_theme'

export function getTheme() {
  try {
    const v = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.wenapTheme = t
  delete document.documentElement.dataset.stockaiTheme
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* ignore */
  }
  return t
}
