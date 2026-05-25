import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

function fmtPrice(n, currency = 'USD') {
  if (!Number.isFinite(n)) return '—'
  const sym = currency === 'JPY' || currency === 'KRW' ? '¥' : '$'
  const digits = currency === 'JPY' || currency === 'KRW' ? 0 : 2
  return `${sym}${n.toFixed(digits)}`
}

export default function KeyLevelsSection({ levels = [], listingCurrency = 'USD', currentPrice = NaN }) {
  const { t } = useTranslation()
  const rows = (Array.isArray(levels) ? levels : []).filter(
    (l) => Number.isFinite(l?.price) && String(l?.label || '').trim(),
  )
  const chart = useMemo(() => {
    if (!rows.length || !Number.isFinite(currentPrice) || currentPrice <= 0) return null
    const prices = rows.map((r) => r.price)
    const lo = Math.min(currentPrice, ...prices) * 0.98
    const hi = Math.max(currentPrice, ...prices) * 1.02
    const span = hi - lo || 1
    return rows.map((r) => ({
      ...r,
      pct: Math.min(100, Math.max(8, ((r.price - lo) / span) * 100)),
      isSpot: Math.abs(r.price - currentPrice) / currentPrice < 0.002,
    }))
  }, [rows, currentPrice])

  if (!rows.length) return null

  return (
    <div className="ma-card ma-key-levels ma-card--soft">
      <h2 className="ma-section-title">{t('report.keyLevelsTitle')}</h2>
      {chart ? (
        <div className="ma-key-levels-chart" aria-hidden>
          {chart.map((r, i) => (
            <div key={i} className="ma-key-levels-bar-row">
              <span className="ma-key-levels-bar-label">{r.label}</span>
              <div className="ma-key-levels-bar-track">
                <div
                  className={`ma-key-levels-bar-fill${r.isSpot ? ' ma-key-levels-bar-fill--spot' : ''}`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <span className="ma-key-levels-bar-price ma-num">{fmtPrice(r.price, listingCurrency)}</span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="ma-key-levels-list">
          {rows.map((l, i) => (
            <li key={i} className="ma-key-levels-item">
              <span className="ma-key-levels-price ma-num">{fmtPrice(l.price, listingCurrency)}</span>
              <span className="ma-key-levels-label">（{l.label}）</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
