/**
 * Hero preview card — links to live NVDA sample. SVG mock matches product radar UX.
 */
export default function LandingHeroPreview({ ticker = 'NVDA', company = 'NVIDIA Corporation', scores = [88, 82, 76, 85, 70, 78] }) {
  const cx = 120
  const cy = 118
  const maxR = 72
  const n = scores.length

  const gridLevels = [0.25, 0.5, 0.75, 1]
  const axisEnds = Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return {
      x: cx + maxR * Math.cos(angle),
      y: cy + maxR * Math.sin(angle),
    }
  })

  const polyPoints = scores
    .map((s, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const r = maxR * (Math.min(100, Math.max(0, s)) / 100)
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    })
    .join(' ')

  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  return (
    <div className="landing-hero-preview-card" aria-hidden>
      <div className="landing-hero-preview-top">
        <span className="landing-hero-preview-badge">Live sample</span>
        <span className="landing-hero-preview-score">{avg}/100</span>
      </div>
      <div className="landing-hero-preview-ticker">{ticker}</div>
      <div className="landing-hero-preview-company">{company}</div>
      <svg className="landing-hero-preview-radar" viewBox="0 0 240 240" role="img" aria-label="Six-dimension radar preview">
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={axisEnds
              .map(({ x, y }) => {
                const px = cx + (x - cx) * level
                const py = cy + (y - cy) * level
                return `${px},${py}`
              })
              .join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {axisEnds.map(({ x, y }, i) => (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        ))}
        <polygon points={polyPoints} fill="rgba(0,212,170,0.28)" stroke="#00d4aa" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="3" fill="#00d4aa" />
      </svg>
      <div className="landing-hero-preview-tags">
        <span>Radar</span>
        <span>Scenarios</span>
        <span>Risks</span>
      </div>
    </div>
  )
}
