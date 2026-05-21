const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const STORAGE_KEY = 'wenap_admin_auth'
const PIN_STORAGE_KEY = 'wenap_admin_pin'

/** 生产环境 /admin 为 SPA；管理接口统一走 /admin-api */
function toAdminApiPath(path) {
  const p = String(path || '').trim()
  if (!p) return '/admin-api'
  if (p.startsWith('/admin-api')) return p
  if (p.startsWith('/admin/')) return `/admin-api/${p.slice(7)}`
  return p.startsWith('/') ? `/admin-api${p}` : `/admin-api/${p}`
}

export function getAdminToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminToken(token) {
  sessionStorage.setItem(STORAGE_KEY, String(token || '').trim())
}

export function clearAdminToken() {
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(PIN_STORAGE_KEY)
}

export function setAdminPin(pin) {
  sessionStorage.setItem(PIN_STORAGE_KEY, String(pin || '').trim())
}

export function getAdminPin() {
  try {
    return sessionStorage.getItem(PIN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export async function adminFetch(path, options = {}) {
  const token = getAdminToken()
  const pin = getAdminPin()
  const res = await fetch(`${API_BASE}${toAdminApiPath(path)}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(pin ? { 'X-Admin-Pin': pin } : {}),
      ...(options.headers || {}),
    },
  })
  if (res.status === 401) {
    clearAdminToken()
    throw new Error('UNAUTHORIZED')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || res.statusText || '请求失败')
  }
  if (res.status === 204) return null
  return res.json()
}

export async function fetchPublicAccuracy() {
  const res = await fetch(`${API_BASE}/accuracy/stats`)
  if (!res.ok) throw new Error('加载失败')
  return res.json()
}
