import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiUrl, getToken } from '../lib/api.js'
import { consumeAnalyzeStream } from '../lib/consumeAnalyzeStream.js'
import { useAuth } from '../context/AuthContext.jsx'
import { snapshotToMobileReport } from '../utils/snapshotToMobileReport.js'
import CompareRadarOverlay from '../components/compare/CompareRadarOverlay.jsx'
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
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 700,
        color: SIGNAL_COLORS[signal] || '#94a3b8',
        background: `${SIGNAL_COLORS[signal] || '#94a3b8'}22`,
      }}
    >
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
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontFamily="system-ui,sans-serif"
        fontWeight="700"
        fontSize="22"
      >
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 3,
        }}
      >
        <span>{name}</span>
        <span>{pct}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            background: color,
            width: `${pct}%`,
            transition: 'width .4s',
          }}
        />
      </div>
    </div>
  )
}

function TickerPanel({ label, report, loading, error }) {
  const { t } = useTranslation()
  if (loading)
    return (
      <div className="compare-panel compare-panel--loading">
        <div className="compare-panel-label">{label}</div>
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
          {t('compare.analyzing')}
        </div>
      </div>
    )
  if (error)
    return (
      <div className="compare-panel compare-panel--error">
        <div className="compare-panel-label">{label}</div>
        <p style={{ color: 'rgba(255,100,100,0.8)', fontSize: 13 }}>{error}</p>
      </div>
    )
  if (!report)
    return (
      <div className="compare-panel compare-panel--empty">
        <div className="compare-panel-label">{label}</div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>{t('compare.enterTicker')}</p>
      </div>
    )
  return (
    <div className="compare-panel">
      <div className="compare-panel-label">{label}</div>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{report.symbol}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
          {report.companyName}
        </div>
        <ScoreRing score={report.score || 0} />
        <div style={{ marginTop: 8 }}>
          <SignalBadge signal={report.signal} />
        </div>
      </div>
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          {t('compare.dimensions')}
        </div>
        {(report.dimensions || []).map((d) => (
          <DimBar key={d.name} name={d.name} score={d.score} />
        ))}
      </div>
      {report.summary && (
        <div
          style={{
            padding: '0 12px 16px',
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.5,
          }}
        >
          {report.summary.slice(0, 200)}
          {report.summary.length > 200 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

function exportCompareCsv(reports, t) {
  const rows = [['Metric', ...reports.map((r) => r.symbol)]]
  rows.push([t('compare.score'), ...reports.map((r) => String(r.score ?? ''))])
  rows.push([t('compare.signal'), ...reports.map((r) => String(r.signal ?? ''))])
  const dimNames = [...new Set(reports.flatMap((r) => (r.dimensions || []).map((d) => d.name)))]
  for (const name of dimNames) {
    rows.push([
      name,
      ...reports.map((r) => {
        const d = (r.dimensions || []).find((x) => x.name === name)
        return String(d?.score ?? '')
      }),
    ])
  }
  const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `wenap-compare-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function ComparePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()

  const [ticker1, setTicker1] = useState('')
  const [ticker2, setTicker2] = useState('')
  const [ticker3, setTicker3] = useState('')
  const [assetType, setAssetType] = useState('stock')
  const [horizon, setHorizon] = useState('3m')

  const [report1, setReport1] = useState(null)
  const [report2, setReport2] = useState(null)
  const [report3, setReport3] = useState(null)
  const [loading1, setLoading1] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const [loading3, setLoading3] = useState(false)
  const [error1, setError1] = useState('')
  const [error2, setError2] = useState('')
  const [error3, setError3] = useState('')

  const locale = i18n.language || 'en'

  function readMacroCountry() {
    try {
      const v = localStorage.getItem('wenap_macroCountry')
      if (v && /^[A-Za-z]{2,3}$/.test(v)) return v.toUpperCase()
    } catch {
      /* ignore */
    }
    return 'USA'
  }

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
        body: JSON.stringify({ ticker: sym, assetType, horizon, locale, macroCountry: readMacroCountry() }),
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
      setReport({
        ...r,
        symbol: sym,
        signal: vizSnapshot?.signal,
        companyName: r.name,
      })
    } catch (e) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function runCompare() {
    const s1 = ticker1.trim().toUpperCase()
    const s2 = ticker2.trim().toUpperCase()
    const s3 = ticker3.trim().toUpperCase()
    await Promise.all([
      s1 ? runAnalysis(s1, setReport1, setLoading1, setError1) : Promise.resolve(),
      s2 ? runAnalysis(s2, setReport2, setLoading2, setError2) : Promise.resolve(),
      s3 ? runAnalysis(s3, setReport3, setLoading3, setError3) : Promise.resolve(),
    ])
  }

  const tier = user?.tier || 'free'
  const isPro = tier === 'pro' || tier === 'pro_plus' || tier === 'proplus'

  const activeReports = [report1, report2, report3].filter(Boolean)
  const anyLoading = loading1 || loading2 || loading3

  if (!isPro) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 48 }}>🔒</div>
        <h2 style={{ margin: 0 }}>{t('compare.proGate')}</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 360 }}>
          {t('compare.lockedNote')}
        </p>
        <Link
          to="/pricing"
          style={{
            background: 'linear-gradient(135deg,#6366f1,#a78bfa)',
            color: 'white',
            padding: '10px 24px',
            borderRadius: 10,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          {t('compare.upgrade')}
        </Link>
        <Link to="/app" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>
          {t('compare.back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="compare-page">
      <div className="compare-header">
        <Link to="/app" className="compare-back">
          ← {t('compare.back')}
        </Link>
        <h1 className="compare-title">{t('compare.title')}</h1>
        <p className="compare-sub">{t('compare.subPro')}</p>
      </div>

      <div className="compare-controls compare-controls--triple">
        <input
          className="compare-input"
          value={ticker1}
          onChange={(e) => setTicker1(e.target.value.toUpperCase())}
          placeholder={t('compare.ticker1')}
          maxLength={16}
        />
        <input
          className="compare-input"
          value={ticker2}
          onChange={(e) => setTicker2(e.target.value.toUpperCase())}
          placeholder={t('compare.ticker2')}
          maxLength={16}
        />
        <input
          className="compare-input"
          value={ticker3}
          onChange={(e) => setTicker3(e.target.value.toUpperCase())}
          placeholder={t('compare.ticker3')}
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
          {HORIZON_IDS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <button className="compare-btn" onClick={runCompare} disabled={anyLoading}>
          {anyLoading ? t('compare.analyzing') : t('compare.run')}
        </button>
        {activeReports.length >= 2 ? (
          <button
            type="button"
            className="compare-btn compare-btn--secondary"
            onClick={() => exportCompareCsv(activeReports, t)}
          >
            {t('compare.exportCsv')}
          </button>
        ) : null}
      </div>

      {activeReports.length >= 2 && !anyLoading ? (
        <CompareRadarOverlay reports={activeReports} />
      ) : null}

      <div className={`compare-panels compare-panels--${activeReports.length || 2}`}>
        <TickerPanel label={ticker1 || t('compare.ticker1')} report={report1} loading={loading1} error={error1} />
        <TickerPanel label={ticker2 || t('compare.ticker2')} report={report2} loading={loading2} error={error2} />
        {ticker3.trim() ? (
          <TickerPanel label={ticker3 || t('compare.ticker3')} report={report3} loading={loading3} error={error3} />
        ) : null}
      </div>

      {report1 && report2 && !anyLoading && (
        <div className="compare-summary">
          <h3 className="compare-summary-title">{t('compare.keyDiffs')}</h3>
          <div className="compare-diff-table">
            <div className="compare-diff-row compare-diff-row--header">
              <span>{t('compare.metric')}</span>
              {activeReports.map((r) => (
                <span key={r.symbol}>{r.symbol}</span>
              ))}
            </div>
            <div className="compare-diff-row">
              <span>{t('compare.score')}</span>
              {activeReports.map((r) => (
                <span key={r.symbol}>{r.score ?? '—'}</span>
              ))}
            </div>
            <div className="compare-diff-row">
              <span>{t('compare.signal')}</span>
              {activeReports.map((r) => (
                <span key={r.symbol}>
                  <SignalBadge signal={r.signal} />
                </span>
              ))}
            </div>
            {(report1.dimensions || []).map((d1) => {
              const allHave = activeReports.every((r) =>
                (r.dimensions || []).some((x) => x.name === d1.name),
              )
              if (!allHave) return null
              return (
                <div key={d1.name} className="compare-diff-row">
                  <span>{d1.name}</span>
                  {activeReports.map((r) => {
                    const d = (r.dimensions || []).find((x) => x.name === d1.name)
                    const best = Math.max(...activeReports.map((x) => {
                      const dx = (x.dimensions || []).find((y) => y.name === d1.name)
                      return dx?.score || 0
                    }))
                    return (
                      <span
                        key={r.symbol}
                        style={{ color: d?.score >= best ? '#4ade80' : '#f87171' }}
                      >
                        {d?.score ?? '—'}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
