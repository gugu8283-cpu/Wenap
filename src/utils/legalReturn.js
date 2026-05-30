const ALLOWED_PREFIXES = [
  '/login',
  '/register',
  '/verify-email',
  '/accept-legal',
  '/forgot-password',
  '/reset-password',
  '/pricing',
]

/** @param {string} raw */
export function parseLegalReturnPath(raw) {
  if (!raw || typeof raw !== 'string') return null
  let decoded = raw.trim()
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    return null
  }
  if (!decoded.startsWith('/')) return null
  const pathname = decoded.split('?')[0]
  if (!ALLOWED_PREFIXES.includes(pathname)) return null
  return decoded
}

/** @param {URLSearchParams} searchParams */
export function legalReturnFromSearch(searchParams) {
  return parseLegalReturnPath(searchParams.get('from') || '')
}

/**
 * @param {string} docPath e.g. /terms
 * @param {string | null | undefined} returnTo full path with optional query
 */
export function legalDocLink(docPath, returnTo) {
  const base = String(docPath || '').trim()
  const back = parseLegalReturnPath(returnTo)
  if (!back) return base
  const q = new URLSearchParams({ from: back })
  return `${base}?${q.toString()}`
}

/**
 * @param {string} returnPath
 * @param {(key: string) => string} t
 */
export function legalReturnLabel(returnPath, t) {
  const pathname = String(returnPath || '').split('?')[0]
  switch (pathname) {
    case '/login':
      return t('legal.backLogin')
    case '/register':
      return t('legal.backRegister')
    case '/verify-email':
      return t('legal.backVerify')
    case '/accept-legal':
      return t('legal.backAcceptLegal')
    case '/forgot-password':
      return t('legal.backForgot')
    case '/reset-password':
      return t('legal.backForgot')
    case '/pricing':
      return t('legal.backPricing')
    default:
      return t('legal.backPrevious')
  }
}
