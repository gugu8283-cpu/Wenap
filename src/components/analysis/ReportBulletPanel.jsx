import ExpandableText from './ExpandableText.jsx'
import { splitToBullets } from '../../utils/compactReportText.js'
import './MobileAnalysisReport.css'

/**
 * @param {{ text?: string, maxBullets?: number, collapsedLines?: number, className?: string }} props
 */
export default function ReportBulletPanel({
  text,
  maxBullets = 4,
  collapsedLines = 3,
  className = '',
}) {
  const bullets = splitToBullets(text, maxBullets)
  if (!bullets.length) return null
  if (bullets.length === 1) {
    return (
      <ExpandableText
        text={bullets[0]}
        className={`ma-compact-prose ${className}`.trim()}
        collapsedLines={collapsedLines}
        minChars={100}
      />
    )
  }
  return (
    <ul className={`ma-bullet-panel ${className}`.trim()}>
      {bullets.map((b, i) => (
        <li key={i}>
          <ExpandableText text={b} as="span" collapsedLines={2} minChars={90} />
        </li>
      ))}
    </ul>
  )
}
