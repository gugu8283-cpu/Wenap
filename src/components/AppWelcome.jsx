import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './AppWelcome.css'

export default function AppWelcome() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0]

  return (
    <div className="app-welcome">
      <div className="app-welcome-glow" aria-hidden />
      <div className="app-welcome-icon" aria-hidden>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="4" y="28" width="8" height="16" rx="2" fill="var(--accent-blue)" opacity="0.7" />
          <rect x="16" y="18" width="8" height="26" rx="2" fill="var(--accent-green)" />
          <rect x="28" y="10" width="8" height="34" rx="2" fill="var(--accent-purple)" opacity="0.85" />
          <path d="M6 26 L24 14 L42 22" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="app-welcome-title">{t('app.welcomeTitle')}</h2>
      <p className="app-welcome-body">{t('app.welcomeBody')}</p>
      <ul className="app-welcome-steps">
        <li>{t('app.welcomeStep1')}</li>
        <li>{t('app.welcomeStep2')}</li>
        <li>{t('app.welcomeStep3')}</li>
      </ul>
      <Link to={`/sample/NVDA?lang=${lang}`} className="app-welcome-sample">
        {t('app.welcomeSample')}
      </Link>
      <p className="app-welcome-tip">{t('app.welcomeTip')}</p>
    </div>
  )
}
