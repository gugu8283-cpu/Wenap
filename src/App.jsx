import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'
import AnalysisViz from './AnalysisViz.jsx'
import EconomicsPanel from './EconomicsPanel.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'
import { resolveAppLanguage } from './i18n/index.js'
import { useAuth } from './context/AuthContext.jsx'
import { apiFetch, getToken } from './lib/api.js'
import { applyTheme, getTheme } from './utils/theme.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const ASSET_TYPE_IDS = ['stock', 'etf', 'reit', 'commodity_etf']
const HORIZON_IDS = ['1m', '3m', '6m', '1y', '2y']

const PRICING = { pro: '$9.99/月', pro_plus: '$19.99/月' }
const FREE_MONTHLY_CAP = 5
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

function formatTs(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
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
  const loadingLines = useMemo(
    () => t('app.loadingLines', { returnObjects: true }),
    [t, i18n.language],
  )
  const segmentTitles = useMemo(() => t('app.segments', { returnObjects: true }), [t, i18n.language])
  const anonId = useMemo(() => ensureAnonId(), [])
  const clientTier = user?.tier || readClientTier()
  const [ticker, setTicker] = useState('')
  const [assetType, setAssetType] = useState('stock')
  const [horizon, setHorizon] = useState('3m')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState(null)
  const [streamText, setStreamText] = useState('')
  const [loadLineIndex, setLoadLineIndex] = useState(0)
  const [watchlist, setWatchlist] = useState([])
  const [watchlistCap, setWatchlistCap] = useState(3)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [historyLocked, setHistoryLocked] = useState(false)
  const [showUpgradeCta, setShowUpgradeCta] = useState(false)
  const [vizSnapshot, setVizSnapshot] = useState(null)
  const [quotaBanner, setQuotaBanner] = useState(null)
  const [theme, setTheme] = useState(() => getTheme())
  const abortRef = useRef(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const segments = useMemo(() => parseSegments(streamText), [streamText])

  const refreshWatchlist = useCallback(async () => {
    let tier = 'free'
    let userId = ''
    try {
      tier = localStorage.getItem('wenap_tier') || 'free'
      userId = localStorage.getItem('wenap_userId') || ''
    } catch {
      /* ignore */
    }
    const base = API_BASE.replace(/\/$/, '')
    const qs = new URLSearchParams({ tier })
    if (anonId) qs.set('anonId', anonId)
    if (userId) qs.set('userId', userId)
    try {
      const r = await fetch(`${base}/watchlist?${qs}`)
      const j = await r.json()
      setWatchlist(j.items || [])
      setWatchlistCap(j.cap || 3)
    } catch {
      /* ignore */
    }
  }, [anonId])

  useEffect(() => {
    refreshWatchlist()
  }, [refreshWatchlist])

  const refreshQuota = useCallback(async () => {
    try {
      const j = await apiFetch('/quota')
      setQuotaBanner(j)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refreshQuota()
  }, [refreshQuota, user?.id])

  useEffect(() => {
    if (!loading || !loadingLines?.length) return
    const timer = setInterval(() => {
      setLoadLineIndex((i) => (i + 1) % loadingLines.length)
    }, 2000)
    return () => clearInterval(timer)
  }, [loading, loadingLines])

  const runAnalyze = useCallback(
    async (overrides = {}) => {
      const sym = String(overrides.ticker ?? ticker).trim().toUpperCase()
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
      setShowUpgradeCta(false)
      setMeta(null)
      setVizSnapshot(null)
      setStreamText('')
      setLoading(true)
      setLoadLineIndex(0)

      const base = API_BASE.replace(/\/$/, '')
      const url = `${base}/analyze`

      const tier = clientTier
      const headers = { 'Content-Type': 'application/json' }
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ticker: sym,
            assetType: ast,
            horizon: hor,
            locale: resolveAppLanguage(i18n.resolvedLanguage || i18n.language),
          }),
          signal: ac.signal,
        })

        const ctype = resp.headers.get('content-type') || ''
        if (!resp.ok) {
          if (ctype.includes('application/json')) {
            const j = await resp.json().catch(() => ({}))
            if (j.error === 'FREE_QUOTA_EXCEEDED') {
              setShowUpgradeCta(true)
            }
            if (j.error === 'EMAIL_NOT_VERIFIED') {
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

        refreshQuota()
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
      }
    },
    [ticker, assetType, horizon, clientTier, refreshQuota, refreshUser, t, i18n.language],
  )

  const addCurrentToWatchlist = useCallback(async () => {
    const sym = ticker.trim().toUpperCase()
    if (!sym) {
      setError('请输入股票代码')
      return
    }
    let tier = 'free'
    let userId = ''
    try {
      tier = localStorage.getItem('wenap_tier') || 'free'
      userId = localStorage.getItem('wenap_userId') || ''
    } catch {
      /* ignore */
    }
    const base = API_BASE.replace(/\/$/, '')
    try {
      const r = await fetch(`${base}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          assetType,
          horizon,
          tier,
          ...(anonId ? { anonId } : {}),
          ...(userId ? { userId } : {}),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 403 && j.error === 'WATCHLIST_CAP') {
        setError(
          `自选已满（${j.cap} 只）。升级 Pro ${PRICING.pro} 可加 20 只，Pro+ ${PRICING.pro_plus} 加 100 只。`,
        )
        return
      }
      if (!r.ok) {
        setError(j.message || j.error || '加入自选失败')
        return
      }
      setWatchlist(j.items || [])
      setWatchlistCap(j.cap || 3)
      setError('')
    } catch {
      setError('加入自选失败')
    }
  }, [ticker, assetType, horizon, anonId])

  const removeFromWatchlist = useCallback(
    async (symbol) => {
      let userId = ''
      try {
        userId = localStorage.getItem('wenap_userId') || ''
      } catch {
        /* ignore */
      }
      const base = API_BASE.replace(/\/$/, '')
      const qs = new URLSearchParams()
      if (anonId) qs.set('anonId', anonId)
      if (userId) qs.set('userId', userId)
      try {
        const r = await fetch(`${base}/watchlist/${encodeURIComponent(symbol)}?${qs}`, {
          method: 'DELETE',
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          setError(j.message || '删除失败')
          return
        }
        setWatchlist(j.items || [])
        setError('')
      } catch {
        setError('删除自选失败')
      }
    },
    [anonId],
  )

  const runFromWatchlist = useCallback(
    (w) => {
      runAnalyze({ ticker: w.symbol, assetType: w.assetType, horizon: w.horizon })
    },
    [runAnalyze],
  )

  const openHistory = useCallback(async () => {
    setHistoryOpen(true)
    let tier = 'free'
    let userId = ''
    try {
      tier = localStorage.getItem('wenap_tier') || 'free'
      userId = localStorage.getItem('wenap_userId') || ''
    } catch {
      /* ignore */
    }
    const base = API_BASE.replace(/\/$/, '')
    const qs = new URLSearchParams({ tier })
    if (anonId) qs.set('anonId', anonId)
    if (userId) qs.set('userId', userId)
    try {
      const r = await fetch(`${base}/history?${qs}`)
      const j = await r.json().catch(() => ({}))
      setHistoryItems(j.items || [])
      setHistoryLocked(Boolean(j.locked))
    } catch {
      setHistoryItems([])
    }
  }, [anonId])

  const loadHistory = useCallback(
    async (id) => {
      setError('')
      let tier = 'free'
      let userId = ''
      try {
        tier = localStorage.getItem('wenap_tier') || 'free'
        userId = localStorage.getItem('wenap_userId') || ''
      } catch {
        /* ignore */
      }
      const base = API_BASE.replace(/\/$/, '')
      const qs = new URLSearchParams({ tier })
      if (anonId) qs.set('anonId', anonId)
      if (userId) qs.set('userId', userId)
      try {
        const r = await fetch(`${base}/history/${encodeURIComponent(id)}?${qs}`)
        const j = await r.json().catch(() => ({}))
        if (r.status === 403 && j.error === 'HISTORY_LOCKED') {
          setError('历史回看仅限 Pro 及以上')
          return
        }
        if (!r.ok) {
          setError(j.message || j.error || '加载失败')
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
    [anonId],
  )

  const hasStream = streamText.length > 0
  const hasResults = Boolean(vizSnapshot || hasStream || meta)

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <p className="brand">Wenap</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <LanguageSwitcher />
            {user?.email ? (
              <span className="tagline" style={{ margin: 0, fontSize: 12 }}>
                {user.email}
                {user.tier && user.tier !== 'free' ? ` · ${user.tier}` : ''}
              </span>
            ) : null}
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
            {watchlist.map((w) => (
              <li key={`${w.symbol}-${w.assetType}`} className="watchlist-item">
                <span className="watchlist-sym">{w.symbol}</span>
                <span className="watchlist-meta">
                  {w.assetType} · {w.horizon}
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
            ))}
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
            placeholder={t('app.tickerPlaceholder')}
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAnalyze()}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

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

        <button
          type="button"
          className="btn-primary"
          disabled={loading}
          onClick={() => runAnalyze()}
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
            {historyItems.length === 0 ? (
              <p className="segment-placeholder">{t('app.historyEmpty')}</p>
            ) : (
              <ul className="history-list">
                {historyItems.map((h) => (
                  <li key={h.id} className="history-item" onClick={() => loadHistory(h.id)}>
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
          <p className="loading-line">{loadingLines[loadLineIndex]}</p>
          <p className="loading-hint">{t('app.loadingHint')}</p>
        </div>
      )}

      {error && (
        <div className="card error-card" role="alert">
          {error}
        </div>
      )}

      {showUpgradeCta && (
        <div className="card upgrade-card">
          <p className="upgrade-title">{t('app.upgradeTitle')}</p>
          <p className="upgrade-row">{t('app.upgradePro', { price: PRICING.pro })}</p>
          <p className="upgrade-row">{t('app.upgradeProPlus', { price: PRICING.pro_plus })}</p>
        </div>
      )}

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
            />
          ) : (
            <>
              {meta?.startedAt && (
                <p className="meta-line">
                  {t('app.metaTime', {
                    time: formatTs(meta.startedAt),
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
        <p>
          {t('app.disclaimer')}
        </p>
        <p className="mt-2 text-center text-sm">
          <a href="/accuracy" className="text-blue-400 hover:underline">
            {t('app.accuracyLink')}
          </a>
        </p>
      </footer>
    </div>
  )
}
