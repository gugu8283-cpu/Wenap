import { WenapChartGraphic } from './WenapChartIcon.jsx'

const IOS_RADIUS = 22.4

/**
 * @param {{ size?: number, variant?: 'full' | 'chart-only' }} props
 */
export default function AppIcon({ size = 180, variant = 'full' }) {
  const chartOnly = variant === 'chart-only' || size <= 29
  const showText = !chartOnly
  const strokeW = size >= 60 ? 2.5 : 2
  const uid = `wi${size}${chartOnly ? 'c' : 'f'}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 86 86"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Wenap"
    >
      <defs>
        <radialGradient id={`${uid}-g1`} cx="0%" cy="0%" r="75%">
          <stop offset="0%" stopColor="rgba(180,0,255,0.18)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${uid}-g2`} cx="100%" cy="100%" r="75%">
          <stop offset="0%" stopColor="rgba(0,212,170,0.14)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <pattern id={`${uid}-grid`} width="10" height="10" patternUnits="userSpaceOnUse">
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke="rgba(0,212,170,0.04)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="86" height="86" rx={(86 * IOS_RADIUS) / 100} fill="#080B14" />
      <rect width="86" height="86" rx={(86 * IOS_RADIUS) / 100} fill={`url(#${uid}-g1)`} />
      <rect width="86" height="86" rx={(86 * IOS_RADIUS) / 100} fill={`url(#${uid}-g2)`} />
      <rect width="86" height="86" rx={(86 * IOS_RADIUS) / 100} fill={`url(#${uid}-grid)`} />
      <g transform={chartOnly ? 'translate(17 17)' : 'translate(17 8)'}>
        <WenapChartGraphic strokeWidth={strokeW} />
      </g>
      {showText ? (
        <g fontFamily="'Syne', sans-serif" textAnchor="middle">
          <text x="43" y="72" fill="#FFFFFF" fontSize="19" fontWeight="800">
            W
          </text>
          <text
            x="43"
            y="83"
            fill="#00D4AA"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.5"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,212,170,0.8))' }}
          >
            ENAP
          </text>
        </g>
      ) : null}
    </svg>
  )
}
