import './MobileAnalysisReport.css'

function LockedBlock({ title, teaser, onUpgrade }) {
  return (
    <div className="ma-pro-field ma-pro-field--locked">
      <p className="ma-pro-field-title">{title}</p>
      <p className="ma-pro-blur-item">{teaser}</p>
      <button type="button" className="ma-pro-field-cta" onClick={onUpgrade}>
        升级 Pro 查看
      </button>
    </div>
  )
}

export default function ProFieldsSection({
  report,
  locked = false,
  onUpgrade,
  keyEventsTeaserCount = 0,
}) {
  const al = report.actionLineObj || {}
  const hasAction =
    Boolean(al.suggestion || al.stopLoss || al.catalyst) || Boolean(report.actionLine)
  const events = report.keyEvents || []
  const eventCount = events.length || keyEventsTeaserCount

  if (locked) {
    return (
      <div className="ma-card ma-pro-fields">
        <h2 className="ma-section-title">Pro 增强</h2>
        {hasAction || report.proFieldHints?.hasActionLine ? (
          <LockedBlock title="操作建议 · 止损 · 催化剂" teaser="建议持有… · 止损 $… · 催化剂：…" onUpgrade={onUpgrade} />
        ) : null}
        {eventCount > 0 ? (
          <LockedBlock
            title="关键时间节点"
            teaser={`已整理 ${eventCount} 条节点，Pro 版查看完整列表`}
            onUpgrade={onUpgrade}
          />
        ) : null}
        {report.proFieldHints?.hasInsider ? (
          <LockedBlock title="内部人动态" teaser="Form 4 · 净买卖倾向…" onUpgrade={onUpgrade} />
        ) : null}
        {report.proFieldHints?.hasPeer ? (
          <LockedBlock title="同行对标" teaser="跑赢行业 · 相对强弱…" onUpgrade={onUpgrade} />
        ) : null}
      </div>
    )
  }

  return (
    <div className="ma-card ma-pro-fields">
      <h2 className="ma-section-title">Pro 增强</h2>
      {hasAction ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">操作建议</p>
          {al.suggestion ? <p className="ma-pro-field-line">建议：{al.suggestion}</p> : null}
          {al.stopLoss ? <p className="ma-pro-field-line">止损：{al.stopLoss}</p> : null}
          {al.catalyst ? <p className="ma-pro-field-line">催化剂：{al.catalyst}</p> : null}
          {!al.suggestion && !al.stopLoss && report.actionLine ? (
            <p className="ma-pro-field-line">{report.actionLine}</p>
          ) : null}
        </div>
      ) : null}
      {events.length ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">关键时间节点</p>
          <ul className="ma-key-events">
            {events.map((ev, i) => (
              <li key={`${ev.date}-${i}`}>
                <strong>{ev.date || '待公告'}</strong> — {ev.event}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {report.leaderInsiderSummary ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">内部人动态</p>
          <p className="ma-pro-field-line">{report.leaderInsiderSummary}</p>
        </div>
      ) : null}
      {report.peerVsSectorLine ? (
        <div className="ma-pro-field">
          <p className="ma-pro-field-title">同行对标</p>
          <p className="ma-pro-field-line">{report.peerVsSectorLine}</p>
        </div>
      ) : null}
    </div>
  )
}
