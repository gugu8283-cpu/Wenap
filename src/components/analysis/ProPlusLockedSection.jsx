import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default function ProPlusLockedSection({ hints = {}, onUpgrade, ticker }) {
  const { t } = useTranslation()
  const [social, setSocial] = useState(null)

  useEffect(() => {
    const base = API_BASE.replace(/\/$/, '')
    fetch(`${base}/stats/social-proof`)
      .then((r) => r.json())
      .then(setSocial)
      .catch(() => {})
  }, [])

  const h = hints || {}
  const any = h.hasBullBear || h.hasScenarioDetail || h.hasSupplyDetail
  if (!any) return null

  return (
    <div className="ma-card ma-pro-plus-locked">
      <h2 className="ma-section-title">{t('report.proPlus.sectionTitle')}</h2>
      {social?.proPlusToday > 0 ? (
        <p className="ma-pro-plus-social">
          {t('convert.socialProofCritique', { count: social.proPlusToday })}
        </p>
      ) : null}
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
        {t('report.proPlus.upgradeCtaLoss')}
      </button>
    </div>
  )
}
