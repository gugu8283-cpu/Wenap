import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

export default function TrustBanner({
  warnings = [],
  freshnessScore = null,
  quoteAsOf = null,
  priceAsOfDisplay = '',
  priceSource = '',
  priceStaleNotice = '',
  dataFieldFreshness = [],
}) {
  const { t } = useTranslation()
  const list = (warnings || []).filter(Boolean)
  const fieldLines = (dataFieldFreshness || []).filter(Boolean)
  const priceLine =
    priceAsOfDisplay && priceAsOfDisplay !== '—'
      ? t('report.priceAsOfLine', {
          datetime: priceAsOfDisplay,
          source: priceSource || 'Alpha Vantage',
        })
      : quoteAsOf && quoteAsOf !== '—'
        ? t('report.priceAsOfLine', { datetime: quoteAsOf, source: priceSource || 'Alpha Vantage' })
        : ''
  if (!list.length && freshnessScore == null && !priceLine && !priceStaleNotice && !fieldLines.length) {
    return null
  }

  const lowFresh = Number.isFinite(freshnessScore) && freshnessScore < 70

  return (
    <div className={`ma-trust-banner${lowFresh ? ' ma-trust-banner--warn' : ''}`} role="note">
      <p className="ma-trust-title">{t('report.trustTitle')}</p>
      {priceLine ? <p className="ma-trust-price-asof">{priceLine}</p> : null}
      {priceStaleNotice ? <p className="ma-trust-price-stale">{priceStaleNotice}</p> : null}
      {Number.isFinite(freshnessScore) ? (
        <p className="ma-trust-score">
          {t('report.freshnessScore', { score: freshnessScore })}
        </p>
      ) : null}
      {fieldLines.length ? (
        <ul className="ma-trust-list ma-trust-list--fields">
          {fieldLines.map((w, i) => (
            <li key={`f-${i}`}>{w}</li>
          ))}
        </ul>
      ) : null}
      {list.length ? (
        <ul className="ma-trust-list">
          {list.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
      <p className="ma-trust-foot">{t('report.trustFoot')}</p>
    </div>
  )
}
