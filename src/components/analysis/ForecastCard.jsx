import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import ReportBulletPanel from './ReportBulletPanel.jsx'
import ReportKvTable from './ReportKvTable.jsx'
import {
  fixTruncatedAssumption,
  isIncompleteAssumption,
  stripMarkdownInline,
} from '../../utils/parseMarkdown.js'

export default function ForecastCard({ forecast, assumption, technicalSnapshot }) {
  const { t } = useTranslation()
  const bodyRaw = [forecast, technicalSnapshot].filter(Boolean).join('\n\n')
  const assumptionRaw = String(assumption || '').trim()
  const assumptionIncomplete = isIncompleteAssumption(assumptionRaw)
  const assumptionText = fixTruncatedAssumption(assumption)
  if (!bodyRaw.trim() && !assumptionText && !assumptionIncomplete) return null

  return (
    <div className="ma-card ma-forecast-card ma-card--soft">
      <h2 className="ma-section-title">{t('report.forecast')}</h2>
      {bodyRaw.trim() ? (
        <ReportBulletPanel text={bodyRaw} maxBullets={4} collapsedLines={2} className="ma-forecast-p" />
      ) : null}
      {assumptionIncomplete ? (
        <p className="ma-forecast-assumption ma-forecast-assumption--loading" aria-busy="true">
          …
        </p>
      ) : assumptionText ? (
        <ReportKvTable
          className="ma-forecast-assumption-wrap"
          rows={[
            {
              label: t('report.forecastAssumptionLabel', { defaultValue: 'Assumption' }),
              value: stripMarkdownInline(assumptionText),
              tone: 'neutral',
            },
          ]}
        />
      ) : null}
    </div>
  )
}
