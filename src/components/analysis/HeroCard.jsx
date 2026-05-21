import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import { scoreHue } from '../../constants/colors.js'
import Sparkline from './Sparkline.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function mapRiskLevel(risk, t) {
  if (risk === '高') return t('report.riskHigh')
  if (risk === '低') return t('report.riskLow')
  if (risk === '中') return t('report.riskMid')
  return risk || '—'
}

function formatGeneratedAt(iso) {
  if (!iso) return { date: '—', time: '—', stale: false }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—', stale: false }
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const stale = Date.now() - d.getTime() > 24 * 60 * 60 * 1000
  return {
    date: d.toISOString().slice(0, 10),
    time: `${hh}:${mm}`,
    stale,
  }
}

export default function HeroCard({ report, onShare, showCompare, onCompare, onReanalyze }) {
  const { t } = useTranslation()
  const sigLabel = (sig) => {
    if (sig === 'buy') return t('report.signalBuy')
    if (sig === 'sell') return t('report.signalSell')
    return t('report.signalHold')
  }
  const r = 55
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, Number(report.score) || 0)) / 100
  const hue = scoreHue(report.score)
  const targetOffset = c * (1 - pct)

  const [ringReady, setRingReady] = useState(false)
  const [sparkPoints, setSparkPoints] = useState(null)
  const [quotePrice, setQuotePrice] = useState(() =>
    Number.isFinite(report.currentPrice) ? report.currentPrice : null,
  )
  const [quoteLoading, setQuoteLoading] = useState(
    () => !Number.isFinite(report.currentPrice) && Boolean(report.ticker),
  )

  useEffect(() => {
    setRingReady(false)
    const t = setTimeout(() => setRingReady(true), 200)
    return () => clearTimeout(t)
  }, [report.ticker, report.score])

  useEffect(() => {
    const sym = String(report.ticker || '').trim().toUpperCase()
    if (!sym) return undefined
    let cancelled = false
    const base = API_BASE.replace(/\/$/, '')
    fetch(`${base}/market/sparkline?ticker=${encodeURIComponent(sym)}`)
      .then((res) => res.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j.points) && j.points.length >= 2) {
          setSparkPoints(j.points)
        }
      })
      .catch(() => {
        if (!cancelled) setSparkPoints(null)
      })
    return () => {
      cancelled = true
    }
  }, [report.ticker])

  useEffect(() => {
    if (Number.isFinite(report.currentPrice)) {
      setQuotePrice(report.currentPrice)
      setQuoteLoading(false)
      return undefined
    }
    const sym = String(report.ticker || '').trim().toUpperCase()
    if (!sym) {
      setQuoteLoading(false)
      return undefined
    }
    let cancelled = false
    setQuoteLoading(true)
    const base = API_BASE.replace(/\/$/, '')
    fetch(`${base}/market/quote?ticker=${encodeURIComponent(sym)}`)
      .then((res) => res.json())
      .then((j) => {
        if (cancelled) return
        const p = Number(j.price)
        if (Number.isFinite(p) && p > 0) setQuotePrice(p)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setQuoteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [report.ticker, report.currentPrice])

  const gen = useMemo(() => formatGeneratedAt(report.generatedAt), [report.generatedAt])
  const dataAsOf = String(report.dataAsOf || '—').trim()

  const displayCurrent = Number.isFinite(quotePrice) ? quotePrice : report.currentPrice
  const displayTarget = report.targetPrice
  const displayUpside = useMemo(() => {
    if (Number.isFinite(report.upside) && report.upside !== 0 && Number.isFinite(report.currentPrice)) {
      return report.upside
    }
    if (
      Number.isFinite(displayCurrent) &&
      Number.isFinite(displayTarget) &&
      displayCurrent > 0
    ) {
      return Math.round(((displayTarget - displayCurrent) / displayCurrent) * 100)
    }
    return NaN
  }, [report.upside, report.currentPrice, displayCurrent, displayTarget])

  const fmtPrice = (n, loading = false) => {
    if (loading) return '…'
    if (!Number.isFinite(n)) return '—'
    return `$${n.toFixed(2)}`
  }

  const upsideStr =
    Number.isFinite(displayUpside) && displayUpside !== 0
      ? `${displayUpside > 0 ? '+' : ''}${displayUpside}%`
      : quoteLoading
        ? '…'
        : '—'

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?symbol=${encodeURIComponent(report.ticker)}`
    try {
      await navigator.clipboard.writeText(url)
      onShare?.(url)
    } catch {
      window.prompt(t('report.sharePrompt'), url)
    }
  }

  return (
    <div className="ma-card ma-hero-card">
      <div className="ma-hero-head">
        <div className="ma-hero-title-block">
          <p className="ma-name">{report.name}</p>
          <p className="ma-hero-sub">
            {report.ticker} · {report.exchange}
          </p>
        </div>
        <div className="ma-hero-actions">
          {showCompare ? (
            <button type="button" className="ma-compare-btn" onClick={() => onCompare?.()}>
              {t('report.compare')}
            </button>
          ) : null}
          <button type="button" className="ma-share-btn" aria-label={t('report.share')} onClick={handleShare}>
            ⎘
          </button>
        </div>
      </div>

      <div className={`ma-hero-mid ma-hero-ring-wrap ma-hero-ring-wrap--${hue.key}`}>
        <svg width={120} height={120} viewBox="0 0 120 120" aria-hidden className="ma-hero-ring-svg">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle
            className="ma-hero-ring-progress"
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={hue.hex}
            strokeWidth="10"
            strokeDasharray={c}
            strokeDashoffset={ringReady ? targetOffset : c}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
          <text
            x="60"
            y="56"
            textAnchor="middle"
            fontSize="36"
            fontWeight="500"
            fill="var(--text-primary)"
            className="ma-num"
          >
            {report.score}
          </text>
          <text x="60" y="72" textAnchor="middle" fontSize="12" fill="var(--text-secondary)" className="ma-num">
            / 100
          </text>
        </svg>
      </div>

      <div className="ma-pills">
        <span className={`ma-pill ma-pill--${report.tendency}`}>{sigLabel(report.tendency)}</span>
        <span className="ma-pill">{t('report.risk', { level: mapRiskLevel(report.risk, t) })}</span>
        {report.riskReward ? <span className="ma-pill">RR {report.riskReward}</span> : null}
        {report.model ? (
          <span className="ma-pill ma-pill--model" title={t('report.modelBadge', { model: report.model })}>
            {report.model.includes('sonnet')
              ? '✦ Sonnet'
              : report.model.includes('haiku')
                ? '✦ Haiku'
                : '✦ Flash'}
          </span>
        ) : null}
      </div>

      <div className="ma-hero-prices ma-num">
        <span>
          {t('report.currentPrice')} {fmtPrice(displayCurrent, quoteLoading)}
        </span>
        {sparkPoints ? (
          <div className="ma-sparkline-wrap">
            <Sparkline points={sparkPoints} />
          </div>
        ) : (
          <div className="ma-sparkline-wrap ma-sparkline-wrap--empty" aria-hidden />
        )}
        <span>
          {t('report.targetPrice')} {fmtPrice(displayTarget)} ·{' '}
          <span className="ma-upside">
            {t('report.upside')} {upsideStr}
          </span>
        </span>
      </div>

      <div className="ma-hero-bottom">
        <button
          type="button"
          className={`ma-hero-ts${gen.stale ? ' ma-hero-ts--stale' : ''}`}
          onClick={() => onReanalyze?.()}
          title={t('report.reanalyzeTitle')}
        >
          {t('report.dataLine', { date: dataAsOf, time: gen.time })}
          {gen.stale ? t('report.staleHint') : ''}
        </button>
      </div>
    </div>
  )
}
