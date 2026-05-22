import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

/**
 * Blurred locked region with Pro badge + CTA. Click opens upgrade flow.
 */
export default function ProSectionLock({ children, ctaText, onUnlock, className = '' }) {
  const { t } = useTranslation()
  const label = ctaText || t('report.pro.upgradeCta')

  return (
    <div className={`ma-tier-lock-wrap ${className}`.trim()}>
      <div className="ma-tier-lock-blur" aria-hidden="false">
        {children}
      </div>
      <button type="button" className="ma-tier-lock-overlay" onClick={onUnlock}>
        <span className="ma-tier-lock-badge">Pro</span>
        <span className="ma-tier-lock-cta">{label}</span>
      </button>
    </div>
  )
}
