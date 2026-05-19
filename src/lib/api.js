const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export function getToken() {
  try {
    return localStorage.getItem('wenap_token') || ''
  } catch {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem('wenap_token', token)
    else localStorage.removeItem('wenap_token')
  } catch {
    /* ignore */
  }
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(apiUrl(path), { ...options, headers })
  let data = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null)
  } else if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (/better_sqlite3|NODE_MODULE_VERSION/i.test(text)) {
      data = {
        error: 'SQLITE_NATIVE',
        message: '后端数据库模块与 Node 版本不匹配。请在 stockai 目录执行 npm run rebuild:native 后重启 npm run dev:full',
      }
    } else if (text && text.length < 280) {
      data = { error: 'HTTP_ERROR', message: text }
    }
  }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`)
    err.status = res.status
    err.code = data?.error
    err.data = data
    throw err
  }
  return data
}
