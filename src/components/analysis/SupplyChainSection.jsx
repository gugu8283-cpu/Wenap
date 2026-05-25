import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import { formatSupplyRelation } from '../../utils/supplyRelation.js'
import ProSectionLock from './ProSectionLock.jsx'
import ProLockPrompt from './ProLockPrompt.jsx'

function badgeLabel(row) {
  const c = String(row.code || '').trim().toUpperCase()
  if (c && c !== '—' && c !== 'N/A') return c
  const n = String(row.name || '')
  const two = [...n].slice(0, 2).join('')
  return two || '—'
}

function SupplyRow({ row, i, onAnalyzeCode, locked = false }) {
  const sym = String(row.analyzeCode || '').trim().toUpperCase()
  const canRun = !locked && /^[A-Z0-9.-]{1,16}$/.test(sym) && sym !== '—'
  const rel = formatSupplyRelation(row.analysis || row.relation)
  return (
    <div
      key={`${row.name}-${i}`}
      className={`ma-supply-row${locked ? ' ma-supply-row--locked' : ''}`}
      role={canRun ? 'button' : undefined}
      tabIndex={canRun ? 0 : undefined}
      onClick={() => {
        if (canRun) onAnalyzeCode?.(sym)
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && canRun) {
          e.preventDefault()
          onAnalyzeCode?.(sym)
        }
      }}
      style={{ opacity: canRun ? 1 : locked ? 1 : 0.85 }}
    >
      <div className="ma-supply-head">
        <div className="ma-supply-id">
          <span className="ma-badge">{badgeLabel(row)}</span>
          <span className="ma-supply-name">{row.name}</span>
        </div>
        <div className="ma-supply-score">
          <div className="ma-supply-score-bar" aria-hidden>
            <div
              className="ma-supply-score-fill"
              style={{ width: `${Math.min(100, row.score)}%` }}
            />
          </div>
          <span className="ma-supply-score-num">{row.score}</span>
        </div>
      </div>
      <p className={rel.placeholder ? 'ma-supply-rel ma-supply-rel--placeholder' : 'ma-supply-rel'}>
        {rel.text}
      </p>
    </div>
  )
}

export default function SupplyChainSection({ rows, onAnalyzeCode, previewMode = false, onUpgrade }) {
  const { t } = useTranslation()
  if (!rows?.length) return null

  const visible = previewMode ? rows.slice(0, 2) : rows
  const locked = previewMode ? rows.slice(2) : []

  return (
    <div className="ma-card ma-supply-card">
      <h2 className="ma-section-title">{t('report.supplyChain')}</h2>
      {visible.map((row, i) => (
        <SupplyRow key={`${row.name}-${i}`} row={row} i={i} onAnalyzeCode={onAnalyzeCode} />
      ))}
      {previewMode && locked.length > 0 ? (
        <>
          <ProSectionLock
            ctaText={t('report.supplyUnlockPro')}
            onUnlock={onUpgrade}
            className="ma-supply-lock-block"
          >
            <div>
              {locked.map((row, i) => (
                <SupplyRow
                  key={`${row.name}-lock-${i}`}
                  row={row}
                  i={i + visible.length}
                  onAnalyzeCode={onAnalyzeCode}
                  locked
                />
              ))}
            </div>
          </ProSectionLock>
          <ProLockPrompt text={t('report.supplyUnlockPro')} onUnlock={onUpgrade} />
        </>
      ) : null}
    </div>
  )
}
