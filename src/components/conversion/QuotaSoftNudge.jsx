import { useTranslation } from 'react-i18next'
import './conversion.css'

/** Shown when free user has 1–2 analyses left (loss + scarcity framing). */
export default function QuotaSoftNudge({ quotaBanner, ticker, onUpgrade }) {
  const { t } = useTranslation()
  if (!quotaBanner || quotaBanner.tier !== 'free' || quotaBanner.unlimited) return null
  const remaining = quotaBanner.remaining
  if (typeof remaining !== 'number' || remaining <= 0 || remaining > 2) return null

  const sym = String(ticker || '').trim().toUpperCase()

  return (
    <div className="ma-card cv-soft-nudge">
      <p className="cv-soft-nudge-text">
        {remaining === 1
          ? t('convert.quotaLastOne', { ticker: sym || t('convert.quotaDefaultTicker') })
          : t('convert.quotaLastTwo', { ticker: sym || t('convert.quotaDefaultTicker') })}
      </p>
      <button type="button" className="cv-soft-nudge-btn" onClick={onUpgrade}>
        {t('convert.quotaSoftCta')}
      </button>
      <button type="button" className="cv-soft-nudge-skip" onClick={(e) => e.target.closest('.cv-soft-nudge')?.remove()}>
        {t('convert.quotaLater')}
      </button>
    </div>
  )
}
