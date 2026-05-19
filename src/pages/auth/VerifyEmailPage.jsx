import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch, setToken } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import './AuthPages.css'

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) return
    apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        if (data?.token) setToken(data.token)
        setSuccess(true)
        await refreshUser()
        setTimeout(() => navigate('/app'), 2000)
      })
      .catch(() => {})
  }, [token, navigate, refreshUser])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const ti = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(ti)
  }, [cooldown])

  async function resend() {
    if (cooldown > 0 || !email) return
    try {
      await apiFetch('/auth/resend-verify', { method: 'POST', body: JSON.stringify({ email }) })
      setSent(true)
      setCooldown(60)
    } catch { /* ignore */ }
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

  return (
    <div className="auth-page">
      <div className="auth-verify-center">
        <svg className="auth-envelope" viewBox="0 0 64 64" fill="none" aria-hidden>
          <rect x="8" y="16" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M8 20 L32 36 L56 20" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h1 className="auth-title">{t('auth.verifyTitle')}</h1>
        <p className="auth-sub" style={{ lineHeight: 1.8 }}>
          {t('auth.verifySentTo', { email: email || t('auth.verifyYourEmail') })}<br />
          {t('auth.verifyCheckInbox')}
        </p>
        <button type="button" className="auth-text-btn" onClick={resend} disabled={cooldown > 0 || !email}>
          {sent && cooldown > 0
            ? t('auth.verifyResentCooldown', { seconds: cooldown })
            : t('auth.verifyResend')}
        </button>
        <p className="auth-bottom" style={{ marginTop: 32 }}>
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </div>
  )
}
