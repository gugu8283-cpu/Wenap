import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api.js'
import './conversion.css'

export default function ResearchProfileCard({ tier = 'free' }) {
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    apiFetch('/user/research-profile')
      .then(setProfile)
      .catch(() => {})
  }, [])

  if (!profile || !profile.analysisCount) return null

  return (
    <section className="card cv-profile-card">
      <h2 className="cv-profile-title">{t('convert.profileTitle')}</h2>
      <div className="cv-profile-grid">
        <div>
          <span className="cv-profile-num">{profile.tickersAnalyzed}</span>
          <span className="cv-profile-label">{t('convert.profileTickers')}</span>
        </div>
        <div>
          <span className="cv-profile-num">{profile.risksIdentified}</span>
          <span className="cv-profile-label">{t('convert.profileRisks')}</span>
        </div>
        <div>
          <span className="cv-profile-num">{profile.hoursSaved}h</span>
          <span className="cv-profile-label">{t('convert.profileHours')}</span>
        </div>
        {profile.winRate != null && profile.winVerified >= 3 ? (
          <div>
            <span className="cv-profile-num">{profile.winRate}%</span>
            <span className="cv-profile-label">
              {t('convert.profileWinRate', {
                hits: profile.winHits,
                total: profile.winVerified,
              })}
            </span>
          </div>
        ) : null}
      </div>
      {tier === 'free' ? (
        <p className="cv-profile-hint">{t('convert.profileAchievement', { count: profile.analysisCount })}</p>
      ) : null}
    </section>
  )
}
