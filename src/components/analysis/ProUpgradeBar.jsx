import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

export default function ProUpgradeBar({ quotaBanner, subscribeUrl, onDevUnlock }) {
  const { t } = useTranslation()

  const hint = useMemo(() => {
    if (!quotaBanner || quotaBanner.tier !== 'free') {
      return t('report.upgradeBar.unlockLoss')
    }
    if (quotaBanner.unlimited) return t('report.upgradeBar.unlockHint')
    const r = quotaBanner.remaining
    if (typeof r !== 'number' || !Number.isFinite(r) || r === Number.POSITIVE_INFINITY) {
      return t('report.upgradeBar.unlockLoss')
    }
    if (r > 0) return t('report.upgradeBar.remainingLoss', { count: r })
    return t('report.upgradeBar.exhaustedLoss')
  }, [quotaBanner, t])

  const onCta = () => {
    const u = String(subscribeUrl || '').trim()
    if (u) {
      window.open(u, '_blank', 'noopener,noreferrer')
    } else if (onDevUnlock) {
      onDevUnlock()
    } else {
      window.location.href = '/pricing'
    }
  }

  return (
    <div className="ma-upgrade-bar">
      <div className="ma-upgrade-bar-inner">
        <span className="ma-upgrade-hint">{hint}</span>
        <button type="button" className="ma-upgrade-cta" onClick={onCta}>
          {t('report.upgradeBar.ctaLoss')}
        </button>
      </div>
    </div>
  )
}
