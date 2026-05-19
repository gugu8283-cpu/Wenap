import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

export default function ProPlusLockedSection({ hints = {}, onUpgrade }) {
  const { t } = useTranslation()
  const h = hints || {}
  const any = h.hasBullBear || h.hasScenarioDetail || h.hasSupplyDetail
  if (!any) return null

  return (
    <div className="ma-card ma-pro-plus-locked">
      <h2 className="ma-section-title">{t('report.proPlus.sectionTitle')}</h2>
      {h.hasBullBear ? (
        <p className="ma-pro-blur-item">{t('report.proPlus.bullBearTeaser')}</p>
      ) : null}
      {h.hasScenarioDetail ? (
        <p className="ma-pro-blur-item">{t('report.proPlus.scenarioTeaser')}</p>
      ) : null}
      {h.hasSupplyDetail ? (
        <p className="ma-pro-blur-item">{t('report.proPlus.supplyTeaser')}</p>
      ) : null}
      <button type="button" className="ma-pro-field-cta" onClick={onUpgrade}>
        {t('report.proPlus.upgradeCta')}
      </button>
    </div>
  )
}
