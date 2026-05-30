import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api.js'
import LegalFooter from '../../components/LegalFooter.jsx'
import '../../components/LegalFooter.css'
import './AuthPages.css'

function passwordStrength(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const STRENGTH_COLORS = ['#2a2a2a', '#e24b4a', '#f5a623', '#00d4aa', '#00d4aa']

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = `${location.pathname}${location.search}`
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const strength = useMemo(() => passwordStrength(password), [password])
  const mismatch = confirm.length > 0 && password !== confirm

  async function handleSubmit(e) {
    e.preventDefault()
    if (!token) {
      setError(t('auth.resetMissingToken'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      if (err.code === 'INVALID_OR_EXPIRED_TOKEN') {
        setError(t('auth.resetInvalidToken'))
      } else if (err.code === 'WEAK_PASSWORD') {
        setError(t('auth.passwordHint'))
      } else {
        setError(err.message || t('auth.resetFail'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">{t('auth.resetTitle')}</h1>
          <p className="auth-error">{t('auth.resetMissingToken')}</p>
          <p className="auth-bottom">
            <Link to="/forgot-password">{t('auth.forgotBtn')}</Link>
            {' · '}
            <Link to="/login">{t('auth.forgotBack')}</Link>
          </p>
          <LegalFooter className="auth-legal-footer" returnTo={returnTo} />
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-verify-center">
          <div className="auth-success-icon">&#10003;</div>
          <h1 className="auth-title">{t('auth.resetSuccess')}</h1>
          <p className="auth-sub">{t('auth.resetRedirecting')}</p>
          <p className="auth-bottom">
            <Link to="/login">{t('auth.backToLogin')}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('auth.resetTitle')}</h1>
        <p className="auth-sub">{t('auth.resetSub')}</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <div className="auth-label-row">
              <span className="auth-label">{t('auth.newPassword')}</span>
              <span className="auth-label-hint">{t('auth.passwordHint')}</span>
            </div>
            <div className="auth-input-wrap">
              <input
                className="auth-input"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button type="button" className="auth-eye" onClick={() => setShowPw((v) => !v)}>
                {showPw ? t('auth.hidePw') : t('auth.showPw')}
              </button>
            </div>
            <div className="auth-strength">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="auth-strength-bar"
                  style={{ background: strength > i ? STRENGTH_COLORS[strength] : '#2a2a2a' }}
                />
              ))}
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label">{t('auth.confirmPassword')}</label>
            <input
              className={`auth-input ${mismatch ? 'auth-input--error' : ''}`}
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
            {mismatch ? <p className="auth-field-error">{t('auth.passwordMismatch')}</p> : null}
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="auth-btn" disabled={loading || mismatch}>
            {loading ? t('auth.resetSaving') : t('auth.resetBtn')}
          </button>
        </form>
        <p className="auth-bottom">
          <Link to="/login">{t('auth.forgotBack')}</Link>
        </p>
        <LegalFooter className="auth-legal-footer" returnTo={returnTo} />
      </div>
    </div>
  )
}
