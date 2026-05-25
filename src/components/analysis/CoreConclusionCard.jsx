import { useTranslation } from 'react-i18next'
import ExpandableText from './ExpandableText.jsx'
import './MobileAnalysisReport.css'

/**
 * @param {{ headline?: string, ifBull?: string, ifBear?: string, action?: string } | null} conclusion
 */
export default function CoreConclusionCard({ conclusion }) {
  const { t } = useTranslation()
  if (!conclusion) return null
  const { headline, ifBull, ifBear, action } = conclusion
  const hasBody = [headline, ifBull, ifBear, action].some((s) => String(s || '').trim())
  if (!hasBody) return null

  return (
    <section className="ma-card ma-core-conclusion" aria-label={t('report.coreConclusionTitle')}>
      <h2 className="ma-core-conclusion-label">{t('report.coreConclusionTitle')}</h2>
      {headline ? (
        <ExpandableText
          text={headline}
          className="ma-core-conclusion-headline"
          collapsedLines={4}
          minChars={120}
        />
      ) : null}
      <ul className="ma-core-conclusion-list">
        {ifBull ? (
          <li className="ma-core-conclusion-row ma-core-conclusion-row--bull">
            <span className="ma-core-conclusion-k">{t('report.coreIfBull')}</span>
            <ExpandableText text={ifBull} as="span" className="ma-core-conclusion-v" collapsedLines={5} minChars={140} />
          </li>
        ) : null}
        {ifBear ? (
          <li className="ma-core-conclusion-row ma-core-conclusion-row--bear">
            <span className="ma-core-conclusion-k">{t('report.coreIfBear')}</span>
            <ExpandableText text={ifBear} as="span" className="ma-core-conclusion-v" collapsedLines={5} minChars={140} />
          </li>
        ) : null}
        {action ? (
          <li className="ma-core-conclusion-row ma-core-conclusion-row--action">
            <span className="ma-core-conclusion-k">{t('report.coreAction')}</span>
            <ExpandableText text={action} as="span" className="ma-core-conclusion-v" collapsedLines={5} minChars={140} />
          </li>
        ) : null}
      </ul>
    </section>
  )
}
