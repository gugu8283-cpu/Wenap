import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import NotificationCenter from './NotificationCenter.jsx'
import './AppNav.css'

function tierLabel(tier) {
  const t = String(tier || 'free').toLowerCase()
  if (t === 'pro_plus' || t === 'proplus') return 'Pro+'
  if (t === 'pro') return 'Pro'
  return null
}

function userInitial(email) {
  const s = String(email || '').trim()
  if (!s) return '?'
  return s[0].toUpperCase()
}

export default function AppNav({ user, theme, onToggleTheme, onLogout }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const isPro = user?.tier === 'pro' || user?.tier === 'pro_plus' || user?.tier === 'proplus'
  const badge = tierLabel(user?.tier)

  const navLink = (to, label, matchPrefix = false) => {
    const active = matchPrefix ? pathname.startsWith(to) : pathname === to
    return (
      <Link to={to} className={`app-nav-link${active ? ' app-nav-link--active' : ''}`}>
        {label}
      </Link>
    )
  }

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <Link to="/app" className="app-nav-brand">
          Wen<span>ap</span>
        </Link>

        <nav className="app-nav-links" aria-label="Main">
          {navLink('/app', t('app.navAnalyze', { defaultValue: 'Analyze' }))}
          {navLink('/sample/NVDA', t('app.navSample', { defaultValue: 'Sample' }), true)}
          {isPro ? navLink('/tools', t('tools.nav', { defaultValue: 'Tools' })) : null}
          {navLink('/pricing', t('app.upgradeBtn', { defaultValue: 'Pricing' }))}
          {user ? navLink('/settings', t('app.navSettings', { defaultValue: 'Settings' })) : null}
        </nav>

        <div className="app-nav-actions">
          {user ? <NotificationCenter /> : null}
          <LanguageSwitcher />
          {user?.email ? (
            <Link to="/settings" className="app-nav-user" title={user.email}>
              <span className="app-nav-avatar" aria-hidden>
                {userInitial(user.email)}
              </span>
              {badge ? <span className={`app-nav-tier app-nav-tier--${user.tier}`}>{badge}</span> : null}
            </Link>
          ) : null}
          <button
            type="button"
            className="app-nav-icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? t('app.themeDark') : t('app.themeLight')}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {user ? (
            <button type="button" className="app-nav-icon-btn app-nav-icon-btn--muted" onClick={onLogout}>
              {t('common.logout')}
            </button>
          ) : null}
        </div>
      </div>
      <p className="app-nav-tagline">{t('app.tagline')}</p>
    </header>
  )
}
