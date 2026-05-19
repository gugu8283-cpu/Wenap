import { stripMarkdownInline } from '../../../utils/parseMarkdown.js'
import '../MobileAnalysisReport.css'

export default function ProPeerBlock({ peerLine }) {
  const t = String(peerLine || '').trim()
  if (!t) return null
  return (
    <section className="ma-pro-sub">
      <h3 className="ma-pro-sub-title">同行对标</h3>
      <p className="ma-pro-sub-body">{stripMarkdownInline(t)}</p>
    </section>
  )
}
