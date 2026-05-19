import { stripMarkdownInline } from '../../../utils/parseMarkdown.js'
import '../MobileAnalysisReport.css'

export default function ProActionBlock({ actionLineObj, actionLine }) {
  const al = actionLineObj || {}
  const has =
    Boolean(al.suggestion || al.stopLoss || al.catalyst) || Boolean(String(actionLine || '').trim())
  if (!has) return null
  return (
    <section className="ma-pro-sub">
      <h3 className="ma-pro-sub-title">操作建议</h3>
      {al.suggestion ? (
        <p className="ma-pro-sub-body">建议：{stripMarkdownInline(al.suggestion)}</p>
      ) : null}
      {al.stopLoss ? <p className="ma-pro-sub-body">止损：{stripMarkdownInline(al.stopLoss)}</p> : null}
      {al.catalyst ? <p className="ma-pro-sub-body">催化剂：{stripMarkdownInline(al.catalyst)}</p> : null}
      {!al.suggestion && !al.stopLoss && actionLine ? (
        <p className="ma-pro-sub-body">{stripMarkdownInline(actionLine)}</p>
      ) : null}
    </section>
  )
}
