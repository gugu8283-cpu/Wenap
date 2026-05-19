import { useMemo } from 'react'
import './MobileAnalysisReport.css'

function upgradeHint(quotaBanner) {
  if (!quotaBanner || quotaBanner.tier !== 'free') {
    return '🔒 升级解锁完整分析'
  }
  if (quotaBanner.unlimited) {
    return '🔒 升级解锁完整分析'
  }
  const r = quotaBanner.remaining
  if (typeof r !== 'number' || !Number.isFinite(r) || r === Number.POSITIVE_INFINITY) {
    return '🔒 升级解锁完整分析'
  }
  if (r > 0) return `🔒 剩余 ${r} 次免费分析`
  return '🔒 免费次数已用完'
}

export default function ProUpgradeBar({ quotaBanner, subscribeUrl, onDevUnlock }) {
  const hint = useMemo(() => upgradeHint(quotaBanner), [quotaBanner])

  const onCta = () => {
    const u = String(subscribeUrl || '').trim()
    if (u) {
      window.open(u, '_blank', 'noopener,noreferrer')
    } else if (onDevUnlock) {
      onDevUnlock()
    }
  }

  return (
    <div className="ma-upgrade-bar">
      <div className="ma-upgrade-bar-inner">
        <span className="ma-upgrade-hint">{hint}</span>
        <button type="button" className="ma-upgrade-cta" onClick={onCta}>
          升级 Pro
        </button>
      </div>
    </div>
  )
}
