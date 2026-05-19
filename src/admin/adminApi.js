const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const STORAGE_KEY = 'wenap_admin_auth'

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
}

export async function adminFetch(path, options = {}) {
  const token = getAdminToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
