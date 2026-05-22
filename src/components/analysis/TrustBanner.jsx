import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

export default function TrustBanner({ warnings = [], freshnessScore = null, quoteAsOf = null }) {
  const { t } = useTranslation()
  const list = (warnings || []).filter(Boolean)
  if (!list.length && freshnessScore == null) return null

  const lowFresh = Number.isFinite(freshnessScore) && freshnessScore < 70

  return (
    <div className={`ma-trust-banner${lowFresh ? ' ma-trust-banner--warn' : ''}`} role="note">
      <p className="ma-trust-title">{t('report.trustTitle')}</p>
      {Number.isFinite(freshnessScore) ? (
        <p className="ma-trust-score">
          {t('report.freshnessScore', { score: freshnessScore })}
          {quoteAsOf && quoteAsOf !== '—' ? ` · ${t('report.quoteAsOf', { date: quoteAsOf })}` : ''}
        </p>
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
