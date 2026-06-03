/** Prefer English API `message`; i18n fallback only when message is empty. */
export function apiErrorMessage(err, t, fallbackKey = 'auth.serverError') {
  const msg = String(err?.message || err?.data?.message || '').trim()
  if (msg) return msg
  return t(fallbackKey)
}

export const authErrorMessage = apiErrorMessage

export function apiSuccessMessage(data, t, fallbackKey) {
  const msg = String(data?.message || '').trim()
  if (msg) return msg
  return fallbackKey ? t(fallbackKey) : ''
}
