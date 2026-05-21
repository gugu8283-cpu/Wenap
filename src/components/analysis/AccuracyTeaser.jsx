import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default function AccuracyTeaser() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const base = API_BASE.replace(/\/$/, '')
    fetch(`${base}/accuracy/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats || !stats.total) return null
  const pct = stats.buySignalWinRate30d ?? stats.tendencyAccuracy
  if (pct == null) return null

  return (
    <Link to="/accuracy" className="ma-accuracy-teaser">
      <span className="ma-accuracy-teaser-icon" aria-hidden>
        📊
      </span>
      <span>
        {t('report.accuracyTeaser', { pct })}
      </span>
      <span className="ma-accuracy-teaser-arrow" aria-hidden>
        →
      </span>
    </Link>
  )
}
