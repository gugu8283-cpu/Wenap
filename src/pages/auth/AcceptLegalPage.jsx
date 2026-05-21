import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import LegalConsentFields, { allRegistrationConsents } from '../../components/LegalConsentFields.jsx'
import LegalFooter from '../../components/LegalFooter.jsx'
import '../../components/LegalFooter.css'
import './AuthPages.css'

export default function AcceptLegalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allOk = allRegistrationConsents({ agreeTerms, agreePrivacy, agreeDisclaimer })

  if (authLoading) {
    return <p className="auth-sub" style={{ textAlign: 'center', marginTop: 40 }}>{t('legal.acceptSubmitting')}</p>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.legal && !user.legal.needsReaccept) {
    return <Navigate to="/app" replace />
  }

  async function submit(e) {
    e.preventDefault()
    if (!allOk) {
      setError(t('legal.registerMustAgreeAll'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiFetch('/auth/accept-legal', {
        method: 'POST',
        body: JSON.stringify({ agreeTerms: true, agreePrivacy: true, agreeDisclaimer: true }),
      })
      await refreshUser()
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err.message || t('legal.acceptFail'))
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
      </div>
      <div className="auth-head">
        <h1 className="auth-title">{t('legal.acceptTitle')}</h1>
        <p className="auth-sub">{t('legal.acceptSub')}</p>
        {user?.email ? (
          <p className="auth-sub" style={{ fontSize: 12 }}>
            {user.email}
          </p>
        ) : null}
      </div>
      <form className="auth-card" onSubmit={submit}>
        {error ? <div className="auth-error">{error}</div> : null}
        <LegalConsentFields
          agreeTerms={agreeTerms}
          agreePrivacy={agreePrivacy}
          agreeDisclaimer={agreeDisclaimer}
          onChangeTerms={setAgreeTerms}
          onChangePrivacy={setAgreePrivacy}
          onChangeDisclaimer={setAgreeDisclaimer}
        />
        <button type="submit" className="auth-btn" disabled={loading || !allOk}>
          {loading ? t('legal.acceptSubmitting') : t('legal.acceptSubmit')}
        </button>
      </form>
      <LegalFooter className="auth-legal-footer" />
    </div>
  )
}
