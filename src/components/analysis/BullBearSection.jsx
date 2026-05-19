import './MobileAnalysisReport.css'

function Side({ label, items, side }) {
  if (!items?.length) return null
  const isBull = side === 'bull'
  return (
    <div className={`ma-bb-side ma-bb-side--${side}`}>
      <p className="ma-bb-side-label">{label}</p>
      <ul className="ma-bb-list">
        {items.map((item, i) => (
          <li key={i} className="ma-bb-item">
            <span className="ma-bb-bullet">·</span>
            <span className="ma-bb-reason">{item.reason}</span>
            {item.weight ? (
              <span className={`ma-bb-weight ma-bb-weight--${side}`}>{item.weight}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function BullBearSection({ bullBearDebate }) {
  const bb = bullBearDebate || { bull: [], bear: [] }
  const bull = bb.bull || []
  const bear = bb.bear || []
  if (!bull.length && !bear.length) return null

  return (
    <div className="ma-card ma-bb-card">
      <h2 className="ma-section-title">多空对撞</h2>
      <div className="ma-bb-grid">
        <Side label="看多" items={bull} side="bull" />
        <Side label="看空" items={bear} side="bear" />
      </div>
    </div>
  )
}
