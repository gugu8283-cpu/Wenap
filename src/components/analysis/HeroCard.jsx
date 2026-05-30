import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import { scoreHue } from '../../constants/colors.js'
import Sparkline from './Sparkline.jsx'

function parseStopPrice(raw) {
  const m = String(raw || '').match(/[\d,]+(?:\.\d+)?/)
  if (!m) return NaN
  const n = parseFloat(m[0].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : NaN
}

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

export default function HeroCard({
  report,
  onShare,
  showCompare,
  onCompare,
  onReanalyze,
  scorePercentile,
}) {
  const { t } = useTranslation()
  const [rrOpen, setRrOpen] = useState(false)
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
  const dataAsOf = String(
    (report.quoteAsOf && report.quoteAsOf !== '—' ? report.quoteAsOf : report.dataAsOf) || '—',
  ).trim()

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
    if (report.assetType === 'forex') {
      const q = report.assetMeta?.quote || report.listingCurrency || ''
      return `${n.toFixed(5)}${q ? ` ${q}` : ''}`
    }
    if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    if (n >= 1) return `$${n.toFixed(2)}`
    return `$${n.toFixed(4)}`
  }

  const formatCompactUsd = (n) => {
    if (!Number.isFinite(n)) return '—'
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    return `$${n.toFixed(0)}`
  }

  const assetMetaLine = useMemo(() => {
    const m = report.assetMeta
    if (!m || typeof m !== 'object') return ''
    if (m.type === 'crypto') {
      const parts = []
      if (Number.isFinite(m.marketCap)) {
        parts.push(t('report.heroCryptoMarketCap', { value: formatCompactUsd(m.marketCap) }))
      }
      if (Number.isFinite(m.volume24h)) {
        parts.push(t('report.heroCryptoVolume', { value: formatCompactUsd(m.volume24h) }))
      }
      if (Number.isFinite(m.change24h)) {
        const sign = m.change24h >= 0 ? '+' : ''
        parts.push(t('report.heroCryptoChange24h', { pct: `${sign}${m.change24h.toFixed(2)}` }))
      }
      return parts.join(' · ')
    }
    if (m.type === 'forex' && m.base && m.quote) {
      return t('report.heroForexPair', { base: m.base, quote: m.quote, rate: Number(m.rate || displayCurrent).toFixed(5) })
    }
    if (m.type === 'commodities') {
      const p = Number.isFinite(displayCurrent) ? displayCurrent : NaN
      const priceStr = Number.isFinite(p)
        ? p >= 1000
          ? `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
          : `$${p.toFixed(2)}`
        : '—'
      return t('report.heroCommoditySpot', {
        label: m.label || report.ticker,
        unit: m.unit || 'USD',
        price: priceStr,
      })
    }
    return ''
  }, [report.assetMeta, report.ticker, displayCurrent, t])

  const stopPrice = parseStopPrice(report.actionLineObj?.stopLoss)
  const rrCalc = useMemo(() => {
    const target = displayTarget
    const current = displayCurrent
    const stop = stopPrice
    if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(stop)) {
      return null
    }
    const reward = target - current
    const risk = current - stop
    if (risk <= 0 || reward <= 0) return null
    const ratio = reward / risk
    return { target, current, stop, reward, risk, ratio }
  }, [displayTarget, displayCurrent, stopPrice])

  const rrDisplay =
    rrCalc && Number.isFinite(rrCalc.ratio)
      ? `1:${rrCalc.ratio.toFixed(1)}`
      : report.riskReward || ''

  const tier = report.reportTier || 'free'
  const showScoreTierHint = tier === 'pro' || tier === 'pro_plus'
  const scoreNum = Number(report.score) || 0
  const showSignalScoreHint =
    scoreNum > 65 && (report.tendency === 'hold' || report.tendency === 'sell')

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
        {Number.isFinite(scorePercentile) && scorePercentile > 0 ? (
          <p className="ma-score-percentile ma-num">
            {t('report.scorePercentile', { pct: scorePercentile })}
          </p>
        ) : null}
      </div>

      <div className="ma-pills">
        <span className="ma-pill-signal-wrap">
          <span className={`ma-pill ma-pill--${report.tendency}`}>{sigLabel(report.tendency)}</span>
          {showSignalScoreHint ? (
            <span className="ma-signal-score-hint">{t('report.signalScoreHint')}</span>
          ) : null}
        </span>
        <span className="ma-pill">{t('report.risk', { level: mapRiskLevel(report.risk, t) })}</span>
        {rrDisplay ? (
          <span className="ma-pill ma-pill--rr">
            <button
              type="button"
              className="ma-rr-btn"
              aria-expanded={rrOpen}
              onClick={() => setRrOpen((v) => !v)}
              title={t('report.rrExplain')}
            >
              RR {rrDisplay}
            </button>
            <button
              type="button"
              className="ma-rr-info"
              aria-label={t('report.rrExplain')}
              aria-expanded={rrOpen}
              title={t('report.rrExplain')}
              onClick={() => setRrOpen((v) => !v)}
            >
              ⓘ
            </button>
            {rrOpen ? (
              <span className="ma-rr-popover" role="tooltip">
                <span className="ma-rr-popover-lead">{t('report.rrExplain')}</span>
                {rrCalc ? (
                  <span className="ma-rr-popover-formula">
                    {t('report.rrFormula', {
                      rr: rrCalc.ratio.toFixed(1),
                      target: rrCalc.target.toFixed(2),
                      current: rrCalc.current.toFixed(2),
                      stop: rrCalc.stop.toFixed(2),
                      reward: rrCalc.reward.toFixed(2),
                      risk: rrCalc.risk.toFixed(2),
                    })}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        ) : null}
        {showScoreTierHint ? (
          <span className="ma-pill ma-pill--info" title={t('report.scoreTierHint')}>
            ⓘ
          </span>
        ) : null}
        {report.model ? (
          <span className="ma-pill ma-pill--model" title={t('report.aiEnhanced')}>
            {t('report.aiEnhanced')}
          </span>
        ) : null}
      </div>

      <div className="ma-hero-prices ma-num">
        <span>
          {t('report.currentPrice')} {fmtPrice(displayCurrent, quoteLoading)}
        </span>
        {report.priceAsOfDisplay ? (
          <span className="ma-hero-price-asof">
            {t('report.priceAsOfLine', {
              datetime: report.priceAsOfDisplay,
              source: report.priceSource || 'Alpha Vantage',
            })}
          </span>
        ) : null}
        {report.priceStaleNotice ? (
          <span className="ma-hero-price-stale">{report.priceStaleNotice}</span>
        ) : null}
        {assetMetaLine ? <span className="ma-hero-price-asof">{assetMetaLine}</span> : null}
        {sparkPoints ? (
          <div className="ma-sparkline-wrap">
            <Sparkline points={sparkPoints} />
          </div>
        ) : (
          <div className="ma-sparkline-wrap ma-sparkline-wrap--empty" aria-hidden />
        )}
        <span>
          {t('report.targetPrice')} {fmtPrice(displayTarget)}
          {Number.isFinite(displayUpside) &&
          displayUpside > 0 &&
          Number.isFinite(displayTarget) &&
          Number.isFinite(displayCurrent) ? (
            <>
              {' '}
              ·{' '}
              <span className="ma-upside ma-upside--loss">
                {t('report.upsideLoss', {
                  amount: (displayTarget - displayCurrent).toFixed(0),
                })}
              </span>
            </>
          ) : (
            <>
              {' '}
              ·{' '}
              <span className="ma-upside">
                {quoteLoading ? '…' : t('report.upsidePending')}
              </span>
            </>
          )}
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
