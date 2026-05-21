import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import './conversion.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const PRICING = { pro: '9.99', proIntro: '4.99' }

export default function UpgradeDecisionModal({
  open,
  onClose,
  profile,
  ticker,
  catalystHint,
  subscribeUrl,
}) {
  const { t } = useTranslation()
  const [social, setSocial] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const base = API_BASE.replace(/\/$/, '')
    fetch(`${base}/stats/social-proof${ticker ? `?ticker=${encodeURIComponent(ticker)}` : ''}`)
      .then((r) => r.json())
      .then(setSocial)
      .catch(() => {})
    return undefined
  }, [open, ticker])

  if (!open) return null

  const ctaHref = subscribeUrl || '/pricing'

  return (
    <div className="cv-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cv-modal">
        <button type="button" className="cv-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {profile?.analysisCount > 0 ? (
          <p className="cv-modal-lead">
            {t('convert.upgradeLeadRisks', {
              count: profile.risksIdentified || profile.analysisCount,
            })}
          </p>
        ) : null}

        {profile?.hoursSaved > 0 ? (
          <p className="cv-modal-stats">
            {t('convert.upgradeStats', {
              win: profile.winRate != null ? `${profile.winRate}%` : '—',
              hours: profile.hoursSaved,
            })}
          </p>
        ) : null}

        {social?.usersTotal > 0 ? (
          <p className="cv-modal-social">{t('convert.upgradeUsers', { count: social.usersTotal })}</p>
        ) : null}
        {social?.upgradesThisWeek > 0 ? (
          <p className="cv-modal-social">{t('convert.upgradeWeek', { count: social.upgradesThisWeek })}</p>
        ) : null}

        {catalystHint ? (
          <p className="cv-modal-urgent">⚠️ {catalystHint}</p>
        ) : ticker ? (
          <p className="cv-modal-urgent">{t('convert.upgradeMissNode', { ticker })}</p>
        ) : null}

        <p className="cv-modal-loss">{t('convert.upgradeLossPro')}</p>

        <div className="cv-modal-price">
          <span className="cv-modal-price-now">${PRICING.proIntro}</span>
          <span className="cv-modal-price-was">${PRICING.pro}</span>
          <span className="cv-modal-price-note">{t('convert.upgradeFirstMonth')}</span>
        </div>

        <a href={ctaHref} className="cv-modal-cta" target={subscribeUrl ? '_blank' : undefined} rel="noreferrer">
          {t('convert.upgradeCta')}
        </a>
        <p className="cv-modal-risk">{t('convert.upgradeCancel')}</p>
        <p className="cv-modal-foot">{t('convert.upgradeCoffee')}</p>

        <Link to="/pricing" className="cv-modal-alt">
          {t('convert.upgradeCompare')}
        </Link>
      </div>
    </div>
  )
}
