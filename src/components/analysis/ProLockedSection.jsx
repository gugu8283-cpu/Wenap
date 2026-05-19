import './MobileAnalysisReport.css'

export default function ProLockedSection({ subscribeUrl, onDevUnlock }) {
  const onUnlock = () => {
    const u = String(subscribeUrl || '').trim()
    if (u) {
      window.open(u, '_blank', 'noopener,noreferrer')
    } else if (onDevUnlock) {
      onDevUnlock()
    }
  }

  return (
    <div className="ma-pro-locked">
      <p className="ma-pro-title">🔒 Pro 专属分析</p>
      <div className="ma-pro-blur-row">
        <div className="ma-pro-blur-item">内部人交易 · Form 4 净买卖…</div>
        <div className="ma-pro-blur-item">完整时间节点 · 财报…</div>
        <div className="ma-pro-blur-item">同行对照 · 相对强弱…</div>
      </div>
      <div className="ma-pro-unlock">
        <button type="button" onClick={onUnlock}>
          解锁查看
        </button>
      </div>
    </div>
  )
}
