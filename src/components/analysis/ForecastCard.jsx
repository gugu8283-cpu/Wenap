import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import { splitParagraphs, fixTruncatedAssumption, stripMarkdownInline } from '../../utils/parseMarkdown.js'

export default function ForecastCard({ forecast, assumption, technicalSnapshot }) {
  const { t } = useTranslation()
  const bodyRaw = [technicalSnapshot, forecast].filter(Boolean).join('\n\n')
  const paragraphs = splitParagraphs(bodyRaw)
  const assumptionText = fixTruncatedAssumption(assumption)
  if (!paragraphs.length && !assumptionText) return null

  return (
    <div className="ma-card ma-forecast-card">
      <h2 className="ma-section-title">{t('report.forecast')}</h2>
      {paragraphs.map((p, i) => (
        <p key={i} className="ma-forecast-p">
          {p}
        </p>
      ))}
      {assumptionText ? (
        <p className="ma-forecast-assumption">{stripMarkdownInline(assumptionText)}</p>
      ) : null}
    </div>
  )
}
