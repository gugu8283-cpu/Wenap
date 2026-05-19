import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import './QuotaStrip.css'

/**
 * Always-visible strip at the top of the app for free users showing remaining quota.
 * Click/tap goes to /pricing.
 */
export default function QuotaStrip({ quotaBanner }) {
  const { t } = useTranslation()
  if (!quotaBanner || quotaBanner.tier !== 'free' || quotaBanner.unlimited) return null

  const remaining = quotaBanner.remaining ?? 0
  const cap = quotaBanner.monthlyCap ?? 5

  return (
    <div className="quota-strip">
      <span className="quota-strip-text">
        {remaining > 0
          ? t('quotaStrip.remaining', { used: cap - remaining, cap, remaining })
          : t('quotaStrip.exhausted', { cap })}
      </span>
      <Link to="/pricing" className="quota-strip-cta">
        {t('quotaStrip.upgrade')}
      </Link>
    </div>
  )
}
