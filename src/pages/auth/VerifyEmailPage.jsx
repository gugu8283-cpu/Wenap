import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch, setToken } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import LegalFooter from '../../components/LegalFooter.jsx'
import '../../components/LegalFooter.css'
import './AuthPages.css'

export default function VerifyEmailPage() {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = `${location.pathname}${location.search}`
  const { refreshUser } = useAuth()
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const symbol = params.get('symbol') || ''
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [success, setSuccess] = useState(false)
  const [verifying, setVerifying] = useState(Boolean(token))
  const [tokenError, setTokenError] = useState('')
  const [resendError, setResendError] = useState('')
  const [emailConfigured, setEmailConfigured] = useState(true)

  useEffect(() => {
    apiFetch('/auth/email-status')
      .then((s) => setEmailConfigured(Boolean(s?.configured)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!token) return
    setVerifying(true)
    setTokenError('')
    apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        if (data?.token) setToken(data.token)
        setSuccess(true)
        await refreshUser()
        const dest = symbol ? `/app?symbol=${encodeURIComponent(symbol)}` : '/app'
        setTimeout(() => navigate(dest), 2000)
      })
      .catch((err) => {
        if (err.code === 'TOKEN_EXPIRED') setTokenError(t('auth.verifyExpired'))
        else setTokenError(t('auth.verifyInvalid'))
      })
      .finally(() => setVerifying(false))
  }, [token, navigate, refreshUser, symbol, t])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const ti = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(ti)
  }, [cooldown])

  async function resend() {
    if (cooldown > 0 || !email) return
    setResendError('')
    try {
      await apiFetch('/auth/resend-verify', {
        method: 'POST',
        body: JSON.stringify({ email, locale: i18n.language }),
      })
      setSent(true)
      setCooldown(60)
    } catch (err) {
      if (err.code === 'EMAIL_NOT_CONFIGURED') {
        setResendError(t('auth.emailNotConfigured'))
      } else if (err.code === 'RATE_LIMIT') {
        setResendError(t('auth.verifyRateLimit'))
      } else {
        setResendError(err.message || t('auth.verifyResendFail'))
      }
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-verify-center">
          <div className="auth-success-icon">&#10003;</div>
          <h1 className="auth-title">{t('auth.verifySuccess')}</h1>
          <p className="auth-sub">{t('auth.verifyRedirecting')}</p>
        </div>
      </div>
    )
  }

  if (token && verifying) {
    return (
      <div className="auth-page">
        <div className="auth-verify-center">
          <span className="auth-spinner" style={{ width: 32, height: 32, marginBottom: 16 }} />
          <p className="auth-sub">{t('auth.verifyProcessing')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-verify-center">
        <svg className="auth-envelope" viewBox="0 0 64 64" fill="none" aria-hidden>
          <rect x="8" y="16" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M8 20 L32 36 L56 20" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h1 className="auth-title">{tokenError ? t('auth.verifyFailedTitle') : t('auth.verifyTitle')}</h1>
        {tokenError ? (
          <p className="auth-error" style={{ marginBottom: 12, textAlign: 'center' }}>
            {tokenError}
          </p>
        ) : null}
        <p className="auth-sub" style={{ lineHeight: 1.8 }}>
          {t('auth.verifySentTo', { email: email || t('auth.verifyYourEmail') })}
          <br />
          {t('auth.verifyCheckInbox')}
          <br />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{t('auth.verifyTtl')}</span>
        </p>
        {!emailConfigured ? (
          <p className="auth-field-error" style={{ marginBottom: 12, textAlign: 'center' }}>
            {t('auth.emailNotConfigured')}
          </p>
        ) : null}
        {resendError ? (
          <p className="auth-field-error" style={{ marginBottom: 12, textAlign: 'center' }}>
            {resendError}
          </p>
        ) : null}
        <button type="button" className="auth-text-btn" onClick={resend} disabled={cooldown > 0 || !email}>
          {sent && cooldown > 0
            ? t('auth.verifyResentCooldown', { seconds: cooldown })
            : t('auth.verifyResend')}
        </button>
        <p className="auth-bottom" style={{ marginTop: 32 }}>
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
        <LegalFooter className="auth-legal-footer" returnTo={returnTo} />
      </div>
    </div>
  )
}
