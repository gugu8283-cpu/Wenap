import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import LegalFooter from '../components/LegalFooter.jsx'
import '../components/LegalFooter.css'
import './SettingsPage.css'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [billing, setBilling] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [referralCopied, setReferralCopied] = useState(false)

  useEffect(() => {
    apiFetch('/billing/config').then(setBilling).catch(() => {})
    apiFetch('/auth/referral-link').then((j) => setReferralLink(j.link || '')).catch(() => {})
  }, [])

  async function copyReferral() {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setReferralCopied(true)
      setTimeout(() => setReferralCopied(false), 2000)
    } catch {
      window.prompt(t('settings.referralCopy'), referralLink)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    setError('')
    try {
      const j = await apiFetch('/billing/portal-session', { method: 'POST', body: '{}' })
      if (j.url) {
        window.location.href = j.url
      } else if (j.error === 'NO_SUBSCRIPTION') {
        setError(t('settings.noSubscription'))
      } else if (j.error === 'STRIPE_NOT_CONFIGURED') {
        setError(t('settings.stripeNotConfigured', { email: 'support@wenap.app' }))
      }
    } catch (e) {
      setError(e?.message || t('settings.portalError'))
    } finally {
      setPortalLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="settings-page">
        <p>{t('settings.notLoggedIn')} <Link to="/login">{t('settings.signIn')}</Link></p>
      </div>
    )
  }

  const tierLabel = user.tier === 'pro_plus' ? 'Pro+' : user.tier === 'pro' ? 'Pro' : t('settings.freeTier')
  const isPaid = user.tier === 'pro' || user.tier === 'pro_plus'

  return (
    <div className="settings-page">
      <div className="settings-top">
        <Link to="/" className="settings-back">← {t('settings.backToApp')}</Link>
      </div>

      <h1 className="settings-title">{t('settings.title')}</h1>

      <div className="settings-card">
        <h2 className="settings-section-title">{t('settings.accountTitle')}</h2>
        <div className="settings-row">
          <span className="settings-label">{t('settings.email')}</span>
          <span className="settings-value">{user.email}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">{t('settings.plan')}</span>
          <span className={`settings-value settings-tier settings-tier--${user.tier}`}>{tierLabel}</span>
        </div>
        {user.tier === 'free' && (
          <div className="settings-row settings-row--cta">
            <Link to="/pricing" className="settings-upgrade-btn">{t('settings.upgradeToPro')}</Link>
          </div>
        )}
      </div>

      {isPaid && (
        <div className="settings-card">
          <h2 className="settings-section-title">{t('settings.subscriptionTitle')}</h2>
          {error && <p className="settings-error">{error}</p>}
          <p className="settings-sub-note">{t('settings.manageNote')}</p>
          <button
            type="button"
            className="settings-portal-btn"
            onClick={openPortal}
            disabled={portalLoading}
          >
            {portalLoading ? t('settings.opening') : t('settings.manageSubscription')}
          </button>
          {!billing?.configured && (
            <p className="settings-sub-note settings-sub-note--warn">
              {t('settings.stripeNotConfigured', { email: 'support@wenap.app' })}
            </p>
          )}
        </div>
      )}

      {referralLink && (
        <div className="settings-card">
          <h2 className="settings-section-title">{t('settings.referralTitle')}</h2>
          <p className="settings-sub-note">{t('settings.referralNote')}</p>
          <div className="settings-referral-row">
            <code className="settings-referral-link">{referralLink}</code>
            <button type="button" className="settings-portal-btn" onClick={copyReferral} style={{ marginLeft: 8, flexShrink: 0 }}>
              {referralCopied ? '✓' : t('settings.referralCopy')}
            </button>
          </div>
        </div>
      )}

      <div className="settings-card">
        <h2 className="settings-section-title">{t('settings.accountActions')}</h2>
        <button type="button" className="settings-logout-btn" onClick={logout}>
          {t('settings.signOut')}
        </button>
      </div>

      <LegalFooter className="settings-legal-footer" />
    </div>
  )
}
