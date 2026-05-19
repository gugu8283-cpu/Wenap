import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

export default function CritiqueSection({ critique }) {
  const { t } = useTranslation()
  const weaknesses = critique?.weaknesses
  if (!weaknesses?.length) return null

  return (
    <div className="ma-card ma-critique-card">
      <h2 className="ma-section-title">{t('report.proPlus.critiqueTitle')}</h2>
      <p className="ma-critique-sub">{t('report.proPlus.critiqueSub')}</p>
      <ul className="ma-critique-list">
        {weaknesses.map((w, i) => (
          <li key={i} className="ma-critique-item">
            <span className="ma-critique-num">{i + 1}</span>
            <span className="ma-critique-text">{w}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
