import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher.jsx'
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

export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referralCode = searchParams.get('ref') || ''
  const prefilledSymbol = searchParams.get('symbol') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)

  const strength = useMemo(() => passwordStrength(password), [password])
  const mismatch = confirm.length > 0 && password !== confirm

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    if (!agreed) {
      setError(t('legal.registerMustAgree'))
      return
    }
    setLoading(true)
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          passwordConfirm: confirm,
          locale: i18n.language,
          ...(referralCode ? { referralCode } : {}),
        }),
      })
      const verifyUrl = `/verify-email?email=${encodeURIComponent(email)}${prefilledSymbol ? `&symbol=${encodeURIComponent(prefilledSymbol)}` : ''}`
      navigate(verifyUrl)
    } catch (err) {
      if (err.code === 'EMAIL_NOT_CONFIGURED') {
        setError(t('auth.emailNotConfigured'))
      } else if (err.code === 'EMAIL_SEND_FAILED') {
        setError(t('auth.emailSendFailed'))
      } else {
        setError(err.message || t('auth.registerFail'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-top">
        <Link to="/" className="auth-logo">
          W<span>enap</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LanguageSwitcher />
          <Link to="/login" className="auth-top-link">
            {t('auth.loginInstead')}
          </Link>
        </div>
      </div>
      <div className="auth-head">
        <h1 className="auth-title">{t('auth.registerTitle')}</h1>
        <p className="auth-sub">{t('auth.registerSub')}</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        {error ? <div className="auth-error">{error}</div> : null}
        <div className="auth-field">
          <label className="auth-label">{t('auth.email')}</label>
          <input
            className="auth-input"
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="auth-field">
          <div className="auth-label-row">
            <span className="auth-label">{t('auth.password')}</span>
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
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {mismatch ? <p className="auth-field-error">{t('auth.passwordMismatch')}</p> : null}
        </div>
        <label className="auth-terms-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            {t('legal.registerAgreePrefix')}{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer">
              {t('legal.nav.terms')}
            </Link>{' '}
            {t('legal.registerAgreeJoin')}{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer">
              {t('legal.nav.privacy')}
            </Link>
            {t('legal.registerAgreeSuffix')}
          </span>
        </label>
        <button type="submit" className="auth-btn" disabled={loading || mismatch || !agreed}>
          {loading ? (
            <>
              <span className="auth-spinner" />
              {t('auth.creating')}
            </>
          ) : (
            t('auth.createAccount')
          )}
        </button>
      </form>
      <LegalFooter className="auth-legal-footer" />
    </div>
  )
}
