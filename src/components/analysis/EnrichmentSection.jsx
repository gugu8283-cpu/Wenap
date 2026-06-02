import { useTranslation } from 'react-i18next'
import './EnrichmentSection.css'

export default function EnrichmentSection({ macroSnapshot, technicals }) {
  const { t } = useTranslation()
  const hasMacro = macroSnapshot?.series?.length > 0
  const hasTech = technicals && Number.isFinite(technicals.rsi14)
  if (!hasMacro && !hasTech) return null

  return (
    <section className="enrichment-section">
      <h3 className="enrichment-title">{t('report.enrichmentTitle')}</h3>
      {hasMacro ? (
        <div className="enrichment-block">
          <div className="enrichment-block-head">{t('report.macroBlock')}</div>
          <ul className="enrichment-list">
            {macroSnapshot.series.map((s) => (
              <li key={s.id}>
                <span className="enrichment-label">{s.label}</span>
                <span className="enrichment-value">
                  {s.value} <span className="enrichment-muted">({s.year})</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="enrichment-source">
            {t('report.dataSource')}: {macroSnapshot.source}{' '}
            {macroSnapshot.sourceUrl ? (
              <a href={macroSnapshot.sourceUrl} target="_blank" rel="noopener noreferrer">
                ↗
              </a>
            ) : null}
            {macroSnapshot.license ? (
              <span className="enrichment-muted"> · {macroSnapshot.license}</span>
            ) : null}
          </p>
          {macroSnapshot.attribution ? (
            <p className="enrichment-source">{macroSnapshot.attribution}</p>
          ) : null}
        </div>
      ) : null}
      {hasTech ? (
        <div className="enrichment-block">
          <div className="enrichment-block-head">{t('report.technicalsBlock')}</div>
          <p className="enrichment-tech-line">
            RSI(14): {technicals.rsi14?.toFixed?.(1) ?? '—'} · SMA20: {technicals.sma20?.toFixed?.(2) ?? '—'} ·
            SMA50: {technicals.sma50?.toFixed?.(2) ?? '—'} · {t('report.trend')}: {technicals.trend}
          </p>
          <p className="enrichment-source">
            {t('report.dataSource')}: {technicals.source || 'EOD'}
          </p>
        </div>
      ) : null}
    </section>
  )
}
