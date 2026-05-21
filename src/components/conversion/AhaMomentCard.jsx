import { useTranslation } from 'react-i18next'
import './conversion.css'

const AHA_KEY = 'wenap_aha_seen'

export function shouldShowAha() {
  try {
    return localStorage.getItem(AHA_KEY) !== '1'
  } catch {
    return true
  }
}

export function markAhaSeen() {
  try {
    localStorage.setItem(AHA_KEY, '1')
  } catch {
    /* ignore */
  }
}

export default function AhaMomentCard({ sourceCount = 0, hasRiskBlindSpot = false, onDismiss }) {
  const { t } = useTranslation()

  return (
    <section className="ma-card cv-aha-card">
      <h2 className="cv-aha-title">{t('convert.ahaTitle')}</h2>
      <p className="cv-aha-sub">{t('convert.ahaSub')}</p>
      <ul className="cv-aha-list">
        <li>{t('convert.ahaScan', { count: Math.max(1, sourceCount || 5) })}</li>
        <li>{t('convert.ahaRadar')}</li>
        <li>
          {hasRiskBlindSpot ? t('convert.ahaRiskFound') : t('convert.ahaRiskScan')}
        </li>
      </ul>
      <p className="cv-aha-foot">{t('convert.ahaFoot')}</p>
      {onDismiss ? (
        <button type="button" className="cv-aha-dismiss" onClick={onDismiss}>
          {t('convert.ahaDismiss')}
        </button>
      ) : null}
    </section>
  )
}
