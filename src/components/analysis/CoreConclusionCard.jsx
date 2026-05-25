import { useTranslation } from 'react-i18next'
import ExpandableText from './ExpandableText.jsx'
import ReportKvTable from './ReportKvTable.jsx'
import './MobileAnalysisReport.css'

/**
 * @param {{ headline?: string, ifBull?: string, ifBear?: string, action?: string } | null} conclusion
 */
export default function CoreConclusionCard({ conclusion }) {
  const { t } = useTranslation()
  if (!conclusion) return null
  const { headline, ifBull, ifBear, action } = conclusion
  const rows = []
  if (ifBull) rows.push({ label: t('report.coreIfBull'), value: ifBull, tone: 'bull' })
  if (ifBear) rows.push({ label: t('report.coreIfBear'), value: ifBear, tone: 'bear' })
  if (action) rows.push({ label: t('report.coreAction'), value: action, tone: 'action' })
  if (!headline && !rows.length) return null

  return (
    <section className="ma-card ma-core-conclusion ma-card--accent" aria-label={t('report.coreConclusionTitle')}>
      <h2 className="ma-section-title ma-section-title--accent">{t('report.coreConclusionTitle')}</h2>
      {headline ? (
        <ExpandableText
          text={headline}
          className="ma-core-conclusion-headline"
          collapsedLines={2}
          minChars={72}
        />
      ) : null}
      {rows.length ? <ReportKvTable rows={rows} /> : null}
    </section>
  )
}
