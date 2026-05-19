import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

export default function ErrorCard({ onRetry }) {
  const { t } = useTranslation()
  return (
    <div className="ma-card ma-error-card" role="alert">
      <div style={{ fontSize: 32 }} aria-hidden>
        ⚠️
      </div>
      <p style={{ margin: '12px 0 0', fontWeight: 500 }}>{t('report.errorTitle')}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          {t('report.retry')}
        </button>
      ) : null}
    </div>
  )
}
