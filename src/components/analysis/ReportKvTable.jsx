import './MobileAnalysisReport.css'

/**
 * Compact label → value rows (table-like, mobile-friendly).
 * @param {{ rows: { label: string, value: string, tone?: 'bull'|'bear'|'action'|'neutral' }[], className?: string }} props
 */
export default function ReportKvTable({ rows = [], className = '' }) {
  const list = rows.filter((r) => r && String(r.value || '').trim())
  if (!list.length) return null
  return (
    <div className={`ma-kv-table ${className}`.trim()} role="table">
      {list.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          className={`ma-kv-row${r.tone ? ` ma-kv-row--${r.tone}` : ''}`}
          role="row"
        >
          <span className="ma-kv-k" role="cell">
            {r.label}
          </span>
          <span className="ma-kv-v" role="cell">
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
