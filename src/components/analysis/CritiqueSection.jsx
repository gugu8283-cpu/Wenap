import { useTranslation } from 'react-i18next'
import ExpandableText from './ExpandableText.jsx'
import './MobileAnalysisReport.css'

export default function CritiqueSection({
  critique,
  previewMode = false,
  lockedCount = 0,
  onUpgrade,
}) {
  const { t } = useTranslation()
  const weaknesses = critique?.weaknesses
  const blindSpot = String(critique?.blindSpot || '').trim()
  const items = []
  if (blindSpot) items.push(blindSpot)
  if (Array.isArray(weaknesses)) items.push(...weaknesses.filter(Boolean))
  if (!items.length) return null

  const visible = previewMode ? items.slice(0, 1) : items
  const hidden = previewMode ? items.slice(1) : []
  const extraLocked = previewMode ? Math.max(lockedCount, hidden.length) : 0

  return (
    <div className="ma-card ma-critique-card">
      <h2 className="ma-section-title">{t('report.proPlus.critiqueTitle')}</h2>
      <p className="ma-critique-sub">{t('report.proPlus.critiqueSub')}</p>
      <ul className="ma-critique-list">
        {visible.map((w, i) => (
          <li key={i} className="ma-critique-item">
            <span className="ma-critique-num">{i + 1}</span>
            <ExpandableText text={w} className="ma-critique-text" collapsedLines={4} minChars={160} />
          </li>
        ))}
        {hidden.map((w, i) => (
          <li key={`blur-${i}`} className="ma-critique-item ma-critique-item--blur" aria-hidden>
            <span className="ma-critique-num">{visible.length + i + 1}</span>
            <ExpandableText text={w} className="ma-critique-text" collapsedLines={4} minChars={160} />
          </li>
        ))}
      </ul>
      {previewMode && extraLocked > 0 ? (
        <div className="ma-critique-lock">
          <p className="ma-critique-lock-text">
            {t('report.critiquePreviewLockLoss', { count: extraLocked })}
          </p>
          {onUpgrade ? (
            <button type="button" className="ma-critique-lock-btn" onClick={onUpgrade}>
              {t('report.proPlus.upgradeCta')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
