import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api.js'
import LegalFooter from '../../components/LegalFooter.jsx'
import '../../components/LegalFooter.css'
import './AuthPages.css'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await apiFetch('/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setSent(true)
    } catch (err) {
      setError(err?.message || t('auth.forgotFail', { defaultValue: 'Request failed, please try again' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.forgotTitle')}</h1>
        <p className="auth-sub">{t('auth.forgotSub')}</p>

        {sent ? (
          <div className="auth-success-banner">
            <p>{t('auth.forgotSent')}</p>
            <Link to="/login" className="auth-text-btn">{t('auth.forgotBack')}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-label" htmlFor="reset-email">
              {t('auth.email')}
            </label>
            <input
              id="reset-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="auth-error">{error}</p>}
            <button
              type="submit"
              className="auth-btn"
              disabled={loading}
            >
              {loading ? t('auth.forgotSending') : t('auth.forgotBtn')}
            </button>
          </form>
        )}

        <p className="auth-bottom">
          <Link to="/login">{t('auth.forgotBack')}</Link>
        </p>
        <LegalFooter className="auth-legal-footer" />
      </div>
    </div>
  )
}
