/** Wenap 折线路径（可嵌入任意 viewBox 的 SVG） */
export function WenapChartGraphic({ strokeWidth = 2 }) {
  const sw = strokeWidth
  return (
    <>
      <line x1="6" y1="38" x2="46" y2="38" stroke="rgba(0,212,170,0.15)" strokeWidth="1" />
      <line x1="6" y1="28" x2="46" y2="28" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <line x1="6" y1="18" x2="46" y2="18" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path
        d="M6 38 L16 26 L26 31 L38 16 L46 20"
        stroke="#00D4AA"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,170,0.8))' }}
      />
      <circle
        cx="38"
        cy="16"
        r="3.5"
        fill="#00D4AA"
        style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,170,1))' }}
      />
    </>
  )
}

export default function WenapChartIcon({ size = 52, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 52 52"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <WenapChartGraphic />
    </svg>
  )
}
