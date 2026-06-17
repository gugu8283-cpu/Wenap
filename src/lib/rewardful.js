/**
 * Rewardful affiliate tracking (Stripe Checkout server-side).
 * Set VITE_REWARDFUL_API_KEY in .env — public site key from Rewardful setup.
 * @see https://help.rewardful.com/en/articles/9014067-integration-using-stripe-server-side-checkout
 */

const KEY = String(import.meta.env.VITE_REWARDFUL_API_KEY || '').trim()
const STORAGE_KEY = 'wenap_rewardful_referral'

function readLiveReferral() {
  try {
    const id = window.Rewardful?.referral
    const s = id != null ? String(id).trim() : ''
    return s && s.length <= 200 ? s : null
  } catch {
    return null
  }
}

function readCachedReferral() {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    return s && s.length <= 200 ? s : null
  } catch {
    return null
  }
}

function cacheReferral(id) {
  try {
    const s = id != null ? String(id).trim() : ''
    if (s && s.length <= 200) sessionStorage.setItem(STORAGE_KEY, s)
  } catch {
    /* ignore */
  }
}

export function rewardfulConfigured() {
  return Boolean(KEY)
}

export function initRewardful() {
  if (!KEY || typeof window === 'undefined' || window.__wenapRewardfulInit) return
  window.__wenapRewardfulInit = true

  const boot = document.createElement('script')
  boot.textContent =
    "(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');"
  document.head.appendChild(boot)

  if (typeof window.rewardful === 'function') {
    window.rewardful('ready', () => {
      const id = readLiveReferral()
      if (id) cacheReferral(id)
    })
  }

  const remote = document.createElement('script')
  remote.async = true
  remote.src = 'https://r.wdfl.co/rw.js'
  remote.dataset.rewardful = KEY
  document.head.appendChild(remote)
}

/** Resolves Rewardful referral UUID for Stripe client_reference_id, or null. */
export function getRewardfulReferralId(timeoutMs = 8000) {
  if (!KEY || typeof window === 'undefined') {
    return Promise.resolve(null)
  }

  const cached = readCachedReferral()
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      const live = readLiveReferral()
      if (live) cacheReferral(live)
      resolve(live || readCachedReferral())
    }

    if (typeof window.rewardful === 'function') {
      window.rewardful('ready', finish)
    }
    setTimeout(finish, timeoutMs)
  })
}
