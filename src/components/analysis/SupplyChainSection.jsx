import './MobileAnalysisReport.css'
import { formatSupplyRelation } from '../../utils/supplyRelation.js'

function badgeLabel(row) {
  const c = String(row.code || '').trim().toUpperCase()
  if (c && c !== '—' && c !== 'N/A') return c
  const n = String(row.name || '')
  const two = [...n].slice(0, 2).join('')
  return two || '—'
}

export default function SupplyChainSection({ rows, onAnalyzeCode }) {
  if (!rows?.length) return null
  return (
    <div className="ma-card ma-supply-card">
      <h2 className="ma-section-title">产业链关联</h2>
      {rows.map((row, i) => {
        const sym = String(row.analyzeCode || '').trim().toUpperCase()
        const canRun = /^[A-Z0-9.-]{1,16}$/.test(sym) && sym !== '—'
        const rel = formatSupplyRelation(row.analysis || row.relation)
        return (
          <div
            key={`${row.name}-${i}`}
            className="ma-supply-row"
            role="button"
            tabIndex={0}
            onClick={() => {
              if (canRun) onAnalyzeCode?.(sym)
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && canRun) {
                e.preventDefault()
                onAnalyzeCode?.(sym)
              }
            }}
            style={{ opacity: canRun ? 1 : 0.85 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span className="ma-badge">{badgeLabel(row)}</span>
              <span style={{ fontSize: 14 }}>{row.name}</span>
            </div>
            <div
              className={rel.placeholder ? 'ma-supply-rel ma-supply-rel--placeholder' : 'ma-supply-rel'}
            >
              {rel.text}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 60,
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--color-border)',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, row.score)}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: 'var(--color-primary)',
                  }}
                />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{row.score}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
