import { stripMarkdownInline } from '../../../utils/parseMarkdown.js'
import '../MobileAnalysisReport.css'

export default function ProInsiderBlock({ summary }) {
  const t = String(summary || '').trim()
  if (!t) return null
  return (
    <section className="ma-pro-sub">
      <h3 className="ma-pro-sub-title">内部人动态</h3>
      <p className="ma-pro-sub-body">{stripMarkdownInline(t)}</p>
    </section>
  )
}
