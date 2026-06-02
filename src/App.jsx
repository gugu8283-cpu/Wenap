import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import './App.css'
import AnalysisViz from './AnalysisViz.jsx'
import EconomicsPanel from './EconomicsPanel.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'
import QuotaStrip from './components/QuotaStrip.jsx'
import ResearchProfileCard from './components/conversion/ResearchProfileCard.jsx'
import UpgradeDecisionModal from './components/conversion/UpgradeDecisionModal.jsx'
import './components/conversion/conversion.css'
import NotificationCenter from './components/NotificationCenter.jsx'
import { resolveAppLanguage } from './i18n/index.js'
import { useAuth } from './context/AuthContext.jsx'
import { apiFetch, getToken } from './lib/api.js'
import { applyTheme, getTheme } from './utils/theme.js'
import { resolveTickerInput } from './utils/tickerResolve.js'
import TickerQuickPicks from './components/TickerQuickPicks.jsx'
import LegalFooter from './components/LegalFooter.jsx'
import './components/LegalFooter.css'
import { resolveMacroCountry } from './utils/macroCountry.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const ASSET_TYPE_IDS = [
  'stock',
  'etf',
  'reit',
  'commodity_etf',
  'crypto',
  'forex',
  'commodities',
]

const TICKER_PLACEHOLDER_KEYS = {
  stock: 'app.tickerPlaceholder',
  etf: 'app.tickerPlaceholder',
  reit: 'app.tickerPlaceholder',
  commodity_etf: 'app.tickerPlaceholder',
  crypto: 'app.tickerPlaceholderCrypto',
  forex: 'app.tickerPlaceholderForex',
  commodities: 'app.tickerPlaceholderCommodities',
}
const HORIZON_IDS = ['1m', '3m', '6m', '1y', '2y']
const RISK_FOCUS_IDS = ['', 'geo', 'competition', 'macro', 'earnings']

const PRICING = { pro: '$9.99/月', pro_plus: '$19.99/月' }
const SUBSCRIBE_URL = String(import.meta.env.VITE_SUBSCRIBE_URL || '').trim()
const DEV_UNLOCK =
  import.meta.env.DEV || String(import.meta.env.VITE_DEV_UNLOCK || '').trim() === '1'

function readClientTier() {
  const raw = String(import.meta.env.VITE_DEV_TIER || '')
    .trim()
    .toLowerCase()
  if (raw === 'pro_plus' || raw === 'proplus') return 'pro_plus'
  if (raw === 'pro') return 'pro'
  try {
    const ls = localStorage.getItem('wenap_tier')
    if (ls === 'pro_plus' || ls === 'pro') return ls
  } catch {
    /* ignore */
  }
  return 'free'
}

function ensureAnonId() {
  try {
    let v = localStorage.getItem('wenap_anonId')
    if (!v) {
      v =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `a${Date.now()}${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('wenap_anonId', v)
    }
    return v
  } catch {
    return ''
  }
}

function signalToClass(s) {
  const u = String(s || '').toUpperCase()
  if (u === 'BUY') return 'buy'
  if (u === 'SELL') return 'sell'
  return 'hold'
}

function stripIncompleteMarker(raw) {
  const i = raw.lastIndexOf('<<<')
  if (i === -1) return raw
  const tail = raw.slice(i)
  if (/^<<<(?:WENAP|STOCKAI)_S[1-4]>>>/.test(tail)) return raw
  if (tail.startsWith('<<<')) return raw.slice(0, i)
  return raw
}

function parseSegments(raw) {
  const safe = stripIncompleteMarker(raw)
  const segs = ['', '', '', '']
  const parts = safe.split(/(<<<(?:WENAP|STOCKAI)_S([1-4])>>>)/)
  for (let i = 1; i < parts.length; i += 3) {
    const num = parseInt(parts[i + 1], 10)
    if (num >= 1 && num <= 4) {
      let body = parts[i + 2] || ''
      const cut = body.search(/<<<(?:WENAP|STOCKAI)_S[1-4]>>>/)
      if (cut !== -1) body = body.slice(0, cut)
      segs[num - 1] = body.trim()
    }
  }
  return segs
}

function formatTs(iso, lang) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const loc = lang || 'en'
    return d.toLocaleString(loc, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function App() {
  const { t, i18n } = useTranslation()
  const { user, logout, refreshUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const handleAuthFailure = useCallback(
    (j) => {
      if (j?.error === 'SESSION_STALE' || j?.error === 'UNAUTHORIZED') {
        logout()
        setError(j.message || t('app.errSessionStale'))
        return true
      }
      if (j?.error === 'BANNED') {
        logout()
        setError(j.message || t('app.errBanned'))
        return true
      }
      return false
    },
    [logout, t],
  )
  const loadingLines = useMemo(() => t('app.loadingLines', { returnObjects: true }), [t])
  const segmentTitles = useMemo(() => t('app.segments', { returnObjects: true }), [t])
  useEffect(() => {
    ensureAnonId()
  }, [])
  const clientTier = user?.tier || readClientTier()
  const [ticker, setTicker] = useState('')
  const [assetType, setAssetType] = useState('stock')
  const [horizon, setHorizon] = useState('3m')
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const loadingStartRef = useRef(null)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState(null)
  const [streamText, setStreamText] = useState('')
  const [loadLineIndex, setLoadLineIndex] = useState(0)
  const [queueHint, setQueueHint] = useState('')
  const [watchlist, setWatchlist] = useState([])
  const [watchlistCap, setWatchlistCap] = useState(3)
  const [watchlistQuotes, setWatchlistQuotes] = useState({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [historyLocked, setHistoryLocked] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historySignalFilter, setHistorySignalFilter] = useState('')
  const [showUpgradeCta, setShowUpgradeCta] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [researchProfile, setResearchProfile] = useState(null)
  const [riskFocus, setRiskFocus] = useState('')
  const [vizSnapshot, setVizSnapshot] = useState(null)
  const [quotaBanner, setQuotaBanner] = useState(null)
  const [theme, setTheme] = useState(() => getTheme())
  const abortRef = useRef(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const segments = useMemo(() => parseSegments(streamText), [streamText])

  const refreshWatchlistPrices = useCallback(async (items) => {
    if (!items || !items.length) return
    const symbols = items.map((w) => w.symbol).join(',')
    try {
      const q = await apiFetch(`/market/snapshot?symbols=${encodeURIComponent(symbols)}`)
      if (q.quotes) setWatchlistQuotes(q.quotes)
    } catch { /* ignore */ }
  }, [])

  const refreshWatchlist = useCallback(async () => {
    try {
      const j = await apiFetch('/watchlist')
      setWatchlist(j.items || [])
      refreshWatchlistPrices(j.items || [])
      setWatchlistCap(j.cap || 3)
    } catch {
      /* ignore */
    }
  }, [refreshWatchlistPrices])

  useEffect(() => {
    refreshWatchlist()
  }, [refreshWatchlist])

  // Auto-fill and trigger from ?symbol= query param (share links)
  useEffect(() => {
    const sym = searchParams.get('symbol')
    if (sym) {
      const clean = sym.trim().toUpperCase()
      setTicker(clean)
      setSearchParams({}, { replace: true })
      // Auto-run analysis if symbol provided
      runAnalyze({ ticker: clean })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshQuota = useCallback(async () => {
    try {
      const j = await apiFetch('/quota')
      setQuotaBanner(j)
    } catch {
      /* ignore */
    }
  }, [])

  const refreshResearchProfile = useCallback(async () => {
    if (!user) return
    try {
      const p = await apiFetch('/user/research-profile')
      setResearchProfile(p)
    } catch {
      /* ignore */
    }
  }, [user])

  useEffect(() => {
    refreshQuota()
    refreshResearchProfile()
  }, [refreshQuota, refreshResearchProfile, user?.id])

  useEffect(() => {
    if (!loading || !loadingLines?.length) return
    const timer = setInterval(() => {
      setLoadLineIndex((i) => (i + 1) % loadingLines.length)
    }, 2000)
    return () => clearInterval(timer)
  }, [loading, loadingLines])

  // Progress bar: creeps toward 98% while waiting — no fixed time cap (completes at 100% when done)
  useEffect(() => {
    if (!loading) {
      setLoadingProgress(0)
      return
    }
    loadingStartRef.current = Date.now()
    setLoadingProgress(2)
    const tick = setInterval(() => {
      const elapsed = Date.now() - (loadingStartRef.current || Date.now())
      const pct = Math.min(98, 2 + Math.log1p(elapsed / 15000) * 22)
      setLoadingProgress(Math.round(pct))
    }, 800)
    return () => clearInterval(tick)
  }, [loading])

  const runAnalyze = useCallback(
    async (overrides = {}) => {
      const sym = resolveTickerInput(overrides.ticker ?? ticker)
      if (!sym) {
        setError(t('app.errTicker'))
        return
      }
      const ast = overrides.assetType ?? assetType
      const hor = overrides.horizon ?? horizon

      if (overrides.ticker != null) setTicker(String(overrides.ticker).trim())
      if (overrides.assetType != null) setAssetType(overrides.assetType)
      if (overrides.horizon != null) setHorizon(overrides.horizon)

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      setError('')
      setQueueHint('')
      setShowUpgradeCta(false)
      setShowUpgradeModal(false)
      setMeta(null)
      setVizSnapshot(null)
      setStreamText('')
      setLoading(true)
      setLoadLineIndex(0)

      const base = API_BASE.replace(/\/$/, '')
      const url = `${base}/analyze`

      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`

      const macroCountry = resolveMacroCountry(sym)

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ticker: sym,
            assetType: ast,
            horizon: hor,
            locale: resolveAppLanguage(i18n.resolvedLanguage || i18n.language),
            riskFocus: riskFocus || undefined,
            macroCountry,
            confirmIncompleteData: overrides.confirmIncompleteData === true,
            forceRefresh: overrides.forceRefresh === true,
          }),
          signal: ac.signal,
        })

        const ctype = resp.headers.get('content-type') || ''
        if (!resp.ok) {
          if (ctype.includes('application/json')) {
            const j = await resp.json().catch(() => ({}))
            if (j.error === 'FREE_QUOTA_EXCEEDED') {
              setShowUpgradeCta(true)
              setShowUpgradeModal(true)
              refreshResearchProfile()
            }
            if (handleAuthFailure(j)) {
              /* cleared stale session */
            } else if (j.error === 'EMAIL_NOT_VERIFIED') {
              setError(j.message || t('app.errVerifyEmail'))
            } else if (j.error === 'RATE_LIMIT') {
              setError(j.message || '请求过于频繁，请稍后再试')
            } else {
              setError(j.message || j.error || `请求失败（${resp.status}）`)
            }
          } else {
            setError(await resp.text().catch(() => `请求失败（${resp.status}）`))
          }
          setLoading(false)
          return
        }

        const reader = resp.body?.getReader()
        if (!reader) {
          setError('无法读取响应流')
          setLoading(false)
          return
        }

        const dec = new TextDecoder()
        let sseBuf = ''
        let needsDataConfirm = false
        let dataWarningMessage = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          sseBuf += dec.decode(value, { stream: true })
          const blocks = sseBuf.split('\n\n')
          sseBuf = blocks.pop() || ''

          for (const block of blocks) {
            for (const line of block.split('\n')) {
              const L = line.trim()
              if (!L.startsWith('data:')) continue
              let data
              try {
                data = JSON.parse(L.slice(5).trim())
              } catch {
                continue
              }
              if (data.type === 'meta') setMeta(data)
              if (data.type === 'queue' && data.message) setQueueHint(data.message)
              if (data.type === 'data_warning') {
                needsDataConfirm = true
                dataWarningMessage = data.message || ''
              }
              if (data.type === 'viz' && data.snapshot) setVizSnapshot(data.snapshot)
              if (data.type === 'token' && data.text) {
                setStreamText((prev) => prev + data.text)
              }
              if (data.type === 'error') setError(data.message || '分析出错')
            }
          }
        }

        if (sseBuf.trim()) {
          for (const line of sseBuf.split('\n')) {
            const L = line.trim()
            if (!L.startsWith('data:')) continue
            try {
              const data = JSON.parse(L.slice(5).trim())
              if (data.type === 'meta') setMeta(data)
              if (data.type === 'queue' && data.message) setQueueHint(data.message)
              if (data.type === 'data_warning') {
                needsDataConfirm = true
                dataWarningMessage = data.message || ''
              }
              if (data.type === 'viz' && data.snapshot) setVizSnapshot(data.snapshot)
              if (data.type === 'token' && data.text) {
                setStreamText((prev) => prev + data.text)
              }
              if (data.type === 'error') setError(data.message || '分析出错')
            } catch {
              /* ignore */
            }
          }
        }

        if (needsDataConfirm && dataWarningMessage) {
          setLoading(false)
          const proceed = window.confirm(dataWarningMessage)
          if (proceed) {
            await runAnalyze({ ...overrides, confirmIncompleteData: true })
          } else {
            setError('')
          }
          return
        }

        setLoadingProgress(100)
        refreshQuota()
        refreshResearchProfile()
        refreshUser()
      } catch (e) {
        if (e?.name === 'AbortError') return
        const msg = e?.message || '网络错误'
        const hint =
          /Failed to fetch|NetworkError|Load failed/i.test(msg) || msg === '网络错误'
            ? ' 本地请确认后端已启动（端口 3002）：在 wenap 目录运行 `node server.cjs`，或一条命令 `npm run dev:full` 同时起前后端。'
            : ''
        setError(msg + hint)
      } finally {
        setLoading(false)
        setQueueHint('')
      }
    },
    [
      ticker,
      assetType,
      horizon,
      riskFocus,
      refreshQuota,
      refreshResearchProfile,
      refreshUser,
      handleAuthFailure,
      t,
      i18n.resolvedLanguage,
      i18n.language,
    ],
  )

  const addCurrentToWatchlist = useCallback(async () => {
    const sym = ticker.trim().toUpperCase()
    if (!sym) {
      setError(t('app.errTicker'))
      return
    }
    try {
      const j = await apiFetch('/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: sym, assetType, horizon }),
      })
      if (j.error === 'WATCHLIST_CAP') {
        setError(t('app.watchlistFull', { cap: j.cap, pro: PRICING.pro, proPlus: PRICING.pro_plus }))
        return
      }
      setWatchlist(j.items || [])
      setWatchlistCap(j.cap || 3)
      setError('')
    } catch {
      setError(t('app.errGeneric'))
    }
  }, [ticker, assetType, horizon, t])

  const removeFromWatchlist = useCallback(
    async (symbol) => {
      try {
        const j = await apiFetch(`/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' })
        setWatchlist(j.items || [])
        setError('')
      } catch {
        setError(t('app.errGeneric'))
      }
    },
    [t],
  )

  const runFromWatchlist = useCallback(
    (w) => {
      runAnalyze({ ticker: w.symbol, assetType: w.assetType, horizon: w.horizon })
    },
    [runAnalyze],
  )

  const openHistory = useCallback(async () => {
    setHistoryOpen(true)
    try {
      const j = await apiFetch('/history')
      setHistoryItems(j.items || [])
      setHistoryLocked(Boolean(j.locked))
    } catch {
      setHistoryItems([])
    }
  }, [])

  const loadHistory = useCallback(
    async (id) => {
      setError('')
      try {
        const locale = resolveAppLanguage(i18n.resolvedLanguage || i18n.language)
        const j = await apiFetch(`/history/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`)
        if (j.error === 'HISTORY_LOCKED') {
          setError(t('app.historyLockedItem'))
          return
        }
        setStreamText(j.markdown || '')
        setVizSnapshot(j.vizSnapshot && typeof j.vizSnapshot === 'object' ? j.vizSnapshot : null)
        setMeta({
          startedAt: j.ts,
          ticker: j.symbol,
          assetType: j.assetType,
          horizon: j.horizon,
        })
      } catch {
        setError(t('app.errLoadHistory'))
      }
    },
    [t, i18n.resolvedLanguage, i18n.language],
  )

  const hasStream = streamText.length > 0
  const hasResults = Boolean(vizSnapshot || hasStream || meta)

  return (
    <div className="app">
      <QuotaStrip quotaBanner={quotaBanner} />
      <header className="header">
        <div className="header-top">
          <p className="brand">
            Wen<span>ap</span>
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {user && <NotificationCenter />}
            <LanguageSwitcher />
            {user?.email ? (
              <Link to="/settings" className="tagline" style={{ margin: 0, fontSize: 12, textDecoration: 'none' }}>
                {user.email}
                {user.tier && user.tier !== 'free' ? ` · ${user.tier.replace('_', '+')}` : ''}
              </Link>
            ) : null}
            {(user?.tier === 'pro' || user?.tier === 'pro_plus' || user?.tier === 'proplus') && (
              <Link to="/tools" className="theme-toggle" style={{ textDecoration: 'none' }}>
                {t('tools.nav', { defaultValue: 'Tools' })}
              </Link>
            )}
            {!user && (
              <Link to="/pricing" className="theme-toggle" style={{ textDecoration: 'none' }}>
                {t('app.upgradeBtn', { defaultValue: 'Pricing' })}
              </Link>
            )}
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((th) => (th === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? t('app.themeDark') : t('app.themeLight')}
            >
              {theme === 'dark' ? t('app.themeDarkBtn') : t('app.themeLightBtn')}
            </button>
            <button type="button" className="theme-toggle" onClick={logout}>
              {t('common.logout')}
            </button>
          </div>
        </div>
        <p className="tagline">{t('app.tagline')}</p>
      </header>

      <section className="card watchlist-card">
        <div className="watchlist-head">
          <p className="label watchlist-label">
            {t('app.watchlist')} · {watchlist.length}/{watchlistCap}
          </p>
          <button type="button" className="link-btn" onClick={addCurrentToWatchlist}>
            {t('app.watchlistAdd')}
          </button>
        </div>
        {watchlist.length === 0 ? (
          <p className="segment-placeholder">{t('app.watchlistEmpty')}</p>
        ) : (
          <ul className="watchlist-list">
            {watchlist.map((w) => {
              const q = watchlistQuotes[w.symbol]
              return (
              <li key={`${w.symbol}-${w.assetType}`} className="watchlist-item">
                <span className="watchlist-sym">{w.symbol}</span>
                <span className="watchlist-meta">
                  {w.assetType} · {w.horizon}
                  {q && (
                    <span style={{ marginLeft: 6, color: q.changePct >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                      {q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%
                    </span>
                  )}
                </span>
                <button type="button" className="pill" onClick={() => runFromWatchlist(w)}>
                  {t('common.analyze')}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeFromWatchlist(w.symbol)}
                  aria-label={t('common.delete')}
                >
                  ×
                </button>
              </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <p className="label">{t('app.assetType')}</p>
        <div className="chip-row" role="tablist" aria-label={t('app.assetType')}>
          {ASSET_TYPE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={assetType === id}
              className={`chip ${assetType === id ? 'chip-active' : ''}`}
              onClick={() => setAssetType(id)}
            >
              {t(`asset.${id}`)}
            </button>
          ))}
        </div>

        <label className="label" htmlFor="ticker">
          {t('app.ticker')}
        </label>
        <div className="search-row">
          <input
            id="ticker"
            className="input"
            placeholder={t(TICKER_PLACEHOLDER_KEYS[assetType] || 'app.tickerPlaceholder')}
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAnalyze()}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <TickerQuickPicks
          assetType={assetType}
          onPick={({ ticker: sym, assetType: ast }) => {
            setTicker(sym)
            setAssetType(ast)
          }}
        />

        <p className="label">{t('app.horizon')}</p>
        <div className="horizon-row">
          {HORIZON_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`pill ${horizon === id ? 'pill-active' : ''}`}
              onClick={() => setHorizon(id)}
            >
              {t(`horizon.${id}`)}
            </button>
          ))}
        </div>

        <p className="label cv-risk-focus-label">{t('convert.riskFocusLabel')}</p>
        <div className="cv-risk-chips" role="group" aria-label={t('convert.riskFocusLabel')}>
          {RISK_FOCUS_IDS.map((id) => (
            <button
              key={id || 'all'}
              type="button"
              className={`cv-risk-chip${riskFocus === id ? ' cv-risk-chip--active' : ''}`}
              onClick={() => setRiskFocus(id)}
            >
              {id ? t(`convert.riskFocus.${id}`) : t('convert.riskFocus.all')}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary"
          disabled={loading}
          onClick={(e) => runAnalyze({ forceRefresh: e.shiftKey })}
        >
          {loading ? t('app.analyzing') : t('app.analyzeBtn')}
        </button>
      </section>

      <section className="card history-card">
        <button
          type="button"
          className="history-toggle"
          onClick={() => {
            if (historyOpen) setHistoryOpen(false)
            else openHistory()
          }}
        >
          <span>📜 {t('app.history')}</span>
          <span>{historyOpen ? t('app.historyCollapse') : t('app.historyExpand')}</span>
        </button>
        {historyOpen && (
          <>
            {historyLocked && (
              <p className="upgrade-hint">{t('app.historyLocked', { pro: PRICING.pro })}</p>
            )}
            {historyItems.length > 0 && (
              <div className="history-filters">
                <input
                  className="history-search"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={t('app.historySearch', { defaultValue: 'Search ticker…' })}
                />
                <select
                  className="history-signal-filter"
                  value={historySignalFilter}
                  onChange={(e) => setHistorySignalFilter(e.target.value)}
                >
                  <option value="">{t('app.historyAllSignals', { defaultValue: 'All signals' })}</option>
                  {['STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL'].map((s) => (
                    <option key={s} value={s}>{s.replace('_',' ')}</option>
                  ))}
                </select>
              </div>
            )}
            {historyItems.length === 0 ? (
              <p className="segment-placeholder">{t('app.historyEmpty')}</p>
            ) : (
              <ul className="history-list">
                {historyItems
                  .filter((h) => {
                    if (historySearch && !h.symbol?.toLowerCase().includes(historySearch.toLowerCase())) return false
                    if (historySignalFilter && h.signal !== historySignalFilter) return false
                    return true
                  })
                  .map((h) => (
                  <li key={h.id} className={`history-item${h.locked ? ' history-item--locked' : ''}`} onClick={() => !h.locked && loadHistory(h.id)}>
                    <div className="history-row1">
                      <strong>{h.symbol}</strong>
                      <span className={`pill score-${signalToClass(h.signal)}`}>
                        {h.score}/100 · {h.signal}
                      </span>
                    </div>
                    <div className="history-row2">
                      {formatTs(h.ts)} · {h.assetType} · {h.horizon}
                    </div>
                    <div className="history-row3">{h.summary}</div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {loading && (
        <div className="card loading-card" aria-live="polite">
          <div className="spinner" aria-hidden />
          <p className="loading-line">{queueHint || loadingLines[loadLineIndex]}</p>
          <p className="loading-hint">{t('app.loadingHint')}</p>
          <div className="loading-progress-bar">
            <div className="loading-progress-fill" style={{ width: `${loadingProgress}%` }} />
          </div>
          <p className="loading-progress-label">{loadingProgress}% · {t('app.loadingAvg', { defaultValue: 'avg ~42s' })}</p>
        </div>
      )}

      {error && (
        <div className="card error-card" role="alert">
          {error}
        </div>
      )}

      <UpgradeDecisionModal
        open={showUpgradeModal || showUpgradeCta}
        onClose={() => {
          setShowUpgradeModal(false)
          setShowUpgradeCta(false)
        }}
        profile={researchProfile}
        ticker={meta?.ticker || ticker}
        catalystHint={
          vizSnapshot?.actionLineObj?.catalyst
            ? t('convert.upgradeCatalyst', {
                ticker: meta?.ticker || ticker,
                event: vizSnapshot.actionLineObj.catalyst,
              })
            : null
        }
        subscribeUrl={SUBSCRIBE_URL}
      />

      {user ? <ResearchProfileCard tier={quotaBanner?.tier || clientTier} /> : null}

      {hasResults && !error && (
        <section className="results">
          {vizSnapshot ? (
            <AnalysisViz
              snapshot={vizSnapshot}
              meta={meta}
              ticker={meta?.ticker || ticker}
              quotaBanner={quotaBanner}
              subscribeUrl={SUBSCRIBE_URL}
              loading={loading}
              onAnalyzeSymbol={(sym) => runAnalyze({ ticker: sym })}
              onDevUnlock={
                DEV_UNLOCK
                  ? () => {
                      // Dev-only: write localStorage tier for UI preview only (server uses JWT)
                      try {
                        localStorage.setItem('wenap_tier', 'pro_plus')
                      } catch {
                        /* ignore */
                      }
                      runAnalyze()
                    }
                  : undefined
              }
              onCompareToast={() => {}}
              onReanalyze={() => runAnalyze()}
              onRequestUpgrade={() => setShowUpgradeModal(true)}
            />
          ) : (
            <>
              {meta?.startedAt && (
                <p className="meta-line">
                  {t('app.metaTime', {
                    time: formatTs(meta.startedAt, i18n.resolvedLanguage || i18n.language),
                    ticker: meta.ticker,
                    asset: t(`asset.${meta.assetType}`, { defaultValue: meta.assetType }),
                    horizon: t(`horizon.${meta.horizon}`, { defaultValue: meta.horizon }),
                  })}
                </p>
              )}
              {segmentTitles.map((title, idx) => (
                <article key={title} className="card segment">
                  <h2 className="segment-title">
                    <span className="segment-num">{idx + 1}</span>
                    {title}
                  </h2>
                  <div className="segment-body">
                    {segments[idx] ? (
                      <pre className="segment-pre">{segments[idx]}</pre>
                    ) : (
                      <p className="segment-placeholder">{loading ? t('app.waitingOutput') : '—'}</p>
                    )}
                  </div>
                </article>
              ))}
            </>
          )}
        </section>
      )}

      {(import.meta.env.DEV || import.meta.env.VITE_SHOW_ECONOMICS === '1') && <EconomicsPanel />}

      <footer className="disclaimer">
        <LegalFooter showDisclaimerLine />
        <p className="mt-2 text-center text-sm">
          <a href="/accuracy" className="text-blue-400 hover:underline">
            {t('app.accuracyLink')}
          </a>
        </p>
      </footer>
    </div>
  )
}
