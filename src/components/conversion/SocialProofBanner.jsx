import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './conversion.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default function SocialProofBanner({ ticker }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const sym = String(ticker || '').trim().toUpperCase()
    if (!sym) return undefined
    const base = API_BASE.replace(/\/$/, '')
    let cancelled = false
    fetch(`${base}/stats/social-proof?ticker=${encodeURIComponent(sym)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setStats(j)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ticker])

  if (!stats) return null
  const views = stats.tickerWeekViews ?? 0
  if (views < 1) return null

  return (
    <p className="cv-social-proof">
      {t('convert.socialProofTicker', { count: views, ticker: stats.ticker || ticker })}
    </p>
  )
}
