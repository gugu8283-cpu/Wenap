import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import {
  splitParagraphs,
  fixTruncatedAssumption,
  isIncompleteAssumption,
  stripMarkdownInline,
} from '../../utils/parseMarkdown.js'

export default function ForecastCard({ forecast, assumption, technicalSnapshot }) {
  const { t } = useTranslation()
  const bodyRaw = [technicalSnapshot, forecast].filter(Boolean).join('\n\n')
  const paragraphs = splitParagraphs(bodyRaw)
  const assumptionRaw = String(assumption || '').trim()
  const assumptionIncomplete = isIncompleteAssumption(assumptionRaw)
  const assumptionText = fixTruncatedAssumption(assumption)
  if (!paragraphs.length && !assumptionText && !assumptionIncomplete) return null

  return (
    <div className="ma-card ma-forecast-card">
      <h2 className="ma-section-title">{t('report.forecast')}</h2>
      {paragraphs.map((p, i) => (
        <p key={i} className="ma-forecast-p">
          {p}
        </p>
      ))}
      {assumptionIncomplete ? (
        <p className="ma-forecast-assumption ma-forecast-assumption--loading" aria-busy="true">
          …
        </p>
      ) : assumptionText ? (
        <p className="ma-forecast-assumption">{stripMarkdownInline(assumptionText)}</p>
      ) : null}
    </div>
  )
}
