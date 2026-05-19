/** 一次性迁移旧 StockAI localStorage 键名 */
const PAIRS = [
  ['stockai_theme', 'wenap_theme'],
  ['stockai_tier', 'wenap_tier'],
  ['stockai_anonId', 'wenap_anonId'],
  ['stockai_userId', 'wenap_userId'],
  ['stockai_admin_secret', 'wenap_admin_auth'],
]

export function migrateLegacyStorage() {
  try {
    for (const [oldKey, newKey] of PAIRS) {
      if (localStorage.getItem(newKey) == null) {
        const v = localStorage.getItem(oldKey)
        if (v != null) localStorage.setItem(newKey, v)
      }
    }
  } catch {
    /* ignore */
  }
}
