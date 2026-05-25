import { useTranslation } from 'react-i18next'
import ExpandableText from './ExpandableText.jsx'
import './MobileAnalysisReport.css'
import ProLockPrompt from './ProLockPrompt.jsx'

function BbItem({ item, side, locked = false }) {
  return (
    <li className={`ma-bb-item${locked ? ' ma-bb-item--locked' : ''}`} aria-hidden={locked || undefined}>
      <span className="ma-bb-bullet">·</span>
      <div className="ma-bb-item-body">
        <ExpandableText text={item.reason} className="ma-bb-reason" collapsedLines={3} minChars={100} />
        {item.weight ? (
          <span className={`ma-bb-weight ma-bb-weight--${side}`}>{item.weight}</span>
        ) : null}
      </div>
    </li>
  )
}

function Side({ label, items, lockedItems, side, previewMode }) {
  if (!items?.length && !lockedItems?.length) return null
  return (
    <div className={`ma-bb-side ma-bb-side--${side}`}>
      <p className="ma-bb-side-label">{label}</p>
      <ul className="ma-bb-list">
        {items.map((item, i) => (
          <BbItem key={`v-${i}`} item={item} side={side} />
        ))}
        {previewMode && lockedItems.map((item, i) => <BbItem key={`l-${i}`} item={item} side={side} locked />)}
      </ul>
    </div>
  )
}

export default function BullBearSection({ bullBearDebate, previewMode = false, onUpgrade }) {
  const { t } = useTranslation()
  const bb = bullBearDebate || { bull: [], bear: [] }
  const bull = bb.bull || []
  const bear = bb.bear || []
  if (!bull.length && !bear.length) return null

  const bullVisible = previewMode ? bull.slice(0, 1) : bull
  const bullLocked = previewMode ? bull.slice(1) : []
  const bearVisible = previewMode ? bear.slice(0, 1) : bear
  const bearLocked = previewMode ? bear.slice(1) : []
  const hasLocked = bullLocked.length > 0 || bearLocked.length > 0

  return (
    <div className="ma-card ma-bb-card">
      <h2 className="ma-section-title">{t('report.proPlus.bullBearTitle')}</h2>
      <div className="ma-bb-grid">
        <Side
          label={t('report.proPlus.bull')}
          items={bullVisible}
          lockedItems={bullLocked}
          side="bull"
          previewMode={previewMode}
        />
        <Side
          label={t('report.proPlus.bear')}
          items={bearVisible}
          lockedItems={bearLocked}
          side="bear"
          previewMode={previewMode}
        />
      </div>
      {previewMode && hasLocked && onUpgrade ? (
        <ProLockPrompt text={t('report.bullBearUnlockPro')} onUnlock={onUpgrade} />
      ) : null}
    </div>
  )
}
