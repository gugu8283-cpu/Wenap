import { useMemo } from 'react'

/**
 * @param {{ points: number[], width?: number, height?: number }} props
 */
export default function Sparkline({ points, width = 280, height = 40 }) {
  const path = useMemo(() => {
    const pts = (points || []).filter((p) => Number.isFinite(p))
    if (pts.length < 2) return null
    const min = Math.min(...pts)
    const max = Math.max(...pts)
    const span = max - min || 1
    const padY = 4
    const innerH = height - padY * 2
    const step = width / (pts.length - 1)
    return pts
      .map((p, i) => {
        const x = i * step
        const y = padY + innerH - ((p - min) / span) * innerH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [points, width, height])

  const trendUp = useMemo(() => {
    const pts = points || []
    if (pts.length < 2) return true
    return pts[pts.length - 1] >= pts[0]
  }, [points])

  if (!path) return null

  return (
    <svg
      className="ma-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke={trendUp ? 'var(--accent-green)' : 'var(--accent-red)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
