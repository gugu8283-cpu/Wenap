import { useState } from 'react'

import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '../../components/LanguageSwitcher.jsx'

import { useAuth } from '../../context/AuthContext.jsx'

import LegalFooter from '../../components/LegalFooter.jsx'
import '../../components/LegalFooter.css'
import './AuthPages.css'



export default function LoginPage() {

  const { t } = useTranslation()

  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`

  const { login } = useAuth()

  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')

  const [showPw, setShowPw] = useState(false)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  const [needsVerify, setNeedsVerify] = useState(false)



  async function submit(e) {

    e.preventDefault()

    setError('')

    setNeedsVerify(false)

    setLoading(true)

    try {

      await login(email.trim(), password)

      navigate('/app', { replace: true })

    } catch (err) {

      if (err.code === 'EMAIL_NOT_VERIFIED') {

        setNeedsVerify(true)

        setError(t('auth.verifyNeed'))

      } else {

        setError(err.message || t('auth.invalidCreds'))

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

          <Link to="/register" className="auth-top-link">

            {t('auth.registerLink')}

          </Link>

        </div>

      </div>

      <div className="auth-head">

        <h1 className="auth-title">{t('auth.loginTitle')}</h1>

        <p className="auth-sub">{t('auth.loginSub')}</p>

      </div>

      <form className="auth-card" onSubmit={submit}>

        {error ? <div className="auth-error">{error}</div> : null}

        {needsVerify ? (

          <p style={{ marginBottom: 12 }}>

            <Link

              to={`/verify-email?email=${encodeURIComponent(email)}`}

              className="auth-top-link"

            >

              {t('auth.resendVerify')}

            </Link>

          </p>

        ) : null}

        <div className="auth-field">

          <label className="auth-label">{t('auth.email')}</label>

          <input

            className="auth-input"

            type="email"

            value={email}

            onChange={(e) => setEmail(e.target.value)}

            required

          />

        </div>

        <div className="auth-field">

          <div className="auth-label-row">

            <span className="auth-label">{t('auth.password')}</span>

            <Link to="/forgot-password" className="auth-top-link" style={{ fontSize: 12 }}>
              {t('auth.forgot')}
            </Link>

          </div>

          <div className="auth-input-wrap">

            <input

              className="auth-input"

              type={showPw ? 'text' : 'password'}

              value={password}

              onChange={(e) => setPassword(e.target.value)}

              required

            />

            <button type="button" className="auth-eye" onClick={() => setShowPw((v) => !v)}>

              {showPw ? t('auth.hidePw') : t('auth.showPw')}

            </button>

          </div>

        </div>

        <button type="submit" className="auth-btn" disabled={loading}>

          {loading ? (

            <>

              <span className="auth-spinner" />

              {t('auth.loggingIn')}

            </>

          ) : (

            t('auth.loginBtn')

          )}

        </button>

      </form>

      <p className="auth-bottom">

        {t('auth.noAccount')}

        <Link to="/register">{t('auth.registerLink')}</Link>

      </p>

      <LegalFooter className="auth-legal-footer" returnTo={returnTo} />

    </div>

  )

}

