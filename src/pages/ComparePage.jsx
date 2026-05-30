import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiUrl, getToken } from '../lib/api.js'
import { consumeAnalyzeStream } from '../lib/consumeAnalyzeStream.js'
import { useAuth } from '../context/AuthContext.jsx'
import { snapshotToMobileReport } from '../utils/snapshotToMobileReport.js'
import './ComparePage.css'

const ASSET_TYPE_IDS = [
  'stock',
  'etf',
  'reit',
  'commodity_etf',
  'crypto',
  'forex',
  'commodities',
]
const HORIZON_IDS = ['1m', '3m', '6m', '1y', '2y']

const SIGNAL_COLORS = {
  STRONG_BUY: '#22c55e',
  BUY: '#4ade80',
  HOLD: '#f59e0b',
  SELL: '#f87171',
  STRONG_SELL: '#ef4444',
}

function SignalBadge({ signal }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 700,
      color: SIGNAL_COLORS[signal] || '#94a3b8',
      background: `${SIGNAL_COLORS[signal] || '#94a3b8'}22`,
    }}>
      {signal?.replace('_', ' ')}
    </span>
  )
}

function ScoreRing({ score }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8"/>
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 50 50)"/>
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
        fill="white" fontFamily="system-ui,sans-serif" fontWeight="700" fontSize="22">
        {score}
      </text>
    </svg>
  )
}

function DimBar({ name, score }) {
  const pct = Math.max(0, Math.min(100, score || 0))
  const color = pct >= 65 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
        <span>{name}</span><span>{pct}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width .4s' }}/>
      </div>
    </div>
  )
}

function TickerPanel({ label, report, loading, error }) {
  const { t } = useTranslation()
  if (loading) return (
    <div className="compare-panel compare-panel--loading">
      <div className="compare-panel-label">{label}</div>
      <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
        {t('compare.analyzing') || 'Analyzing…'}
      </div>
    </div>
  )
  if (error) return (
    <div className="compare-panel compare-panel--error">
      <div className="compare-panel-label">{label}</div>
      <p style={{ color: 'rgba(255,100,100,0.8)', fontSize: 13 }}>{error}</p>
    </div>
  )
  if (!report) return (
    <div className="compare-panel compare-panel--empty">
      <div className="compare-panel-label">{label}</div>
      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>{t('compare.enterTicker') || 'Enter a ticker above'}</p>
    </div>
  )
  return (
    <div className="compare-panel">
      <div className="compare-panel-label">{label}</div>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{report.symbol}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>{report.companyName}</div>
        <ScoreRing score={report.score || 0}/>
        <div style={{ marginTop: 8 }}><SignalBadge signal={report.signal}/></div>
      </div>
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{t('compare.dimensions') || 'Dimensions'}</div>
        {(report.dimensions || []).map((d) => (
          <DimBar key={d.name} name={d.name} score={d.score}/>
        ))}
      </div>
      {report.summary && (
        <div style={{ padding: '0 12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          {report.summary.slice(0, 200)}{report.summary.length > 200 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

export default function ComparePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const [ticker1, setTicker1] = useState('')
  const [ticker2, setTicker2] = useState('')
  const [assetType, setAssetType] = useState('stock')
  const [horizon, setHorizon] = useState('3m')

  const [report1, setReport1] = useState(null)
  const [report2, setReport2] = useState(null)
  const [loading1, setLoading1] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const [error1, setError1] = useState('')
  const [error2, setError2] = useState('')

  const locale = i18n.language || 'en'

  async function runAnalysis(sym, setReport, setLoading, setError) {
    if (!sym) return
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const token = getToken()
      const resp = await fetch(apiUrl('/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticker: sym, assetType, horizon, locale }),
      })
      const ctype = resp.headers.get('content-type') || ''
      if (!resp.ok) {
        if (ctype.includes('application/json')) {
          const data = await resp.json().catch(() => ({}))
          throw new Error(data.message || data.error || `HTTP ${resp.status}`)
        }
        throw new Error(`HTTP ${resp.status}`)
      }
      const { vizSnapshot, meta: streamMeta } = await consumeAnalyzeStream(resp)
      const r = snapshotToMobileReport(vizSnapshot, { ticker: sym, startedAt: streamMeta?.startedAt })
      setReport({ ...r, symbol: sym })
    } catch (e) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function runCompare() {
    const s1 = ticker1.trim().toUpperCase()
    const s2 = ticker2.trim().toUpperCase()
    await Promise.all([
      s1 ? runAnalysis(s1, setReport1, setLoading1, setError1) : Promise.resolve(),
      s2 ? runAnalysis(s2, setReport2, setLoading2, setError2) : Promise.resolve(),
    ])
  }

  const tier = user?.tier || 'free'
  const isProPlus = tier === 'pro_plus' || tier === 'proplus'

  if (!isProPlus) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h2 style={{ margin: 0 }}>{t('compare.proPlus') || 'Pro+ Compare'}</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 360 }}>
          {t('compare.lockedNote') || 'Side-by-side AI comparison is a Pro+ exclusive feature.'}
        </p>
        <Link to="/pricing" style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: 'white', padding: '10px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 600 }}>
          {t('compare.upgrade') || 'Upgrade to Pro+'}
        </Link>
        <Link to="/app" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>
          {t('compare.back') || '← Back'}
        </Link>
      </div>
    )
  }

  return (
    <div className="compare-page">
      <div className="compare-header">
        <Link to="/app" className="compare-back">← {t('compare.back') || 'Back'}</Link>
        <h1 className="compare-title">{t('compare.title') || 'Compare Tickers'}</h1>
      </div>

      <div className="compare-controls">
        <input
          className="compare-input"
          value={ticker1}
          onChange={(e) => setTicker1(e.target.value.toUpperCase())}
          placeholder={t('compare.ticker1') || 'Ticker 1 (e.g. AAPL)'}
          maxLength={16}
        />
        <span className="compare-vs">vs</span>
        <input
          className="compare-input"
          value={ticker2}
          onChange={(e) => setTicker2(e.target.value.toUpperCase())}
          placeholder={t('compare.ticker2') || 'Ticker 2 (e.g. MSFT)'}
          maxLength={16}
        />
        <select className="compare-select" value={assetType} onChange={(e) => setAssetType(e.target.value)}>
          {ASSET_TYPE_IDS.map((a) => (
            <option key={a} value={a}>
              {t(`asset.${a}`, { defaultValue: a })}
            </option>
          ))}
        </select>
        <select className="compare-select" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
          {HORIZON_IDS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <button className="compare-btn" onClick={runCompare} disabled={loading1 || loading2}>
          {(loading1 || loading2) ? (t('compare.analyzing') || 'Analyzing…') : (t('compare.run') || 'Compare')}
        </button>
      </div>

      {/* Side-by-side panels */}
      <div className="compare-panels">
        <TickerPanel
          label={ticker1 || (t('compare.ticker1') || 'Ticker 1')}
          report={report1}
          loading={loading1}
          error={error1}
        />
        <TickerPanel
          label={ticker2 || (t('compare.ticker2') || 'Ticker 2')}
          report={report2}
          loading={loading2}
          error={error2}
        />
      </div>

      {/* Key differences summary */}
      {report1 && report2 && !loading1 && !loading2 && (
        <div className="compare-summary">
          <h3 className="compare-summary-title">{t('compare.keyDiffs') || 'Key Differences'}</h3>
          <div className="compare-diff-table">
            <div className="compare-diff-row compare-diff-row--header">
              <span>{t('compare.metric') || 'Metric'}</span>
              <span>{report1.symbol || ticker1}</span>
              <span>{report2.symbol || ticker2}</span>
            </div>
            <div className="compare-diff-row">
              <span>{t('compare.score') || 'Score'}</span>
              <span>{report1.score ?? '—'}</span>
              <span>{report2.score ?? '—'}</span>
            </div>
            <div className="compare-diff-row">
              <span>{t('compare.signal') || 'Signal'}</span>
              <span><SignalBadge signal={report1.signal}/></span>
              <span><SignalBadge signal={report2.signal}/></span>
            </div>
            {(report1.dimensions || []).map((d1) => {
              const d2 = (report2.dimensions || []).find((x) => x.name === d1.name)
              if (!d2) return null
              return (
                <div key={d1.name} className="compare-diff-row">
                  <span>{d1.name}</span>
                  <span style={{ color: d1.score >= d2.score ? '#4ade80' : '#f87171' }}>{d1.score}</span>
                  <span style={{ color: d2.score >= d1.score ? '#4ade80' : '#f87171' }}>{d2.score}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
