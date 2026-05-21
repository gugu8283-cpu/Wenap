import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

function fmtPrice(n, currency = 'USD') {
  if (!Number.isFinite(n)) return '—'
  const sym = currency === 'JPY' || currency === 'KRW' ? '¥' : '$'
  const digits = currency === 'JPY' || currency === 'KRW' ? 0 : 2
  return `${sym}${n.toFixed(digits)}`
}

export default function KeyLevelsSection({ levels = [], listingCurrency = 'USD' }) {
  const { t } = useTranslation()
  const rows = (Array.isArray(levels) ? levels : []).filter(
    (l) => Number.isFinite(l?.price) && String(l?.label || '').trim(),
  )
  if (!rows.length) return null

  return (
    <div className="ma-card ma-key-levels">
      <h2 className="ma-section-title">{t('report.keyLevelsTitle')}</h2>
      <ul className="ma-key-levels-list">
        {rows.map((l, i) => (
          <li key={i} className="ma-key-levels-item">
            <span className="ma-key-levels-price ma-num">{fmtPrice(l.price, listingCurrency)}</span>
            <span className="ma-key-levels-label">（{l.label}）</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
