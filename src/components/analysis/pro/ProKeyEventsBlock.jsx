import { stripMarkdownInline } from '../../../utils/parseMarkdown.js'
import '../MobileAnalysisReport.css'

export default function ProKeyEventsBlock({ keyEvents }) {
  const events = keyEvents || []
  if (!events.length) return null
  return (
    <section className="ma-pro-sub">
      <h3 className="ma-pro-sub-title">关键时间节点</h3>
      <ul className="ma-key-events">
        {events.map((ev, i) => (
          <li key={`${ev.date}-${i}`}>
            <strong>{ev.date || '待公告'}</strong> — {stripMarkdownInline(ev.event)}
          </li>
        ))}
      </ul>
    </section>
  )
}
