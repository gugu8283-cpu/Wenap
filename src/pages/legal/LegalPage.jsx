import { useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher.jsx'
import { legalReturnFromSearch, legalReturnLabel } from '../../utils/legalReturn.js'
import './LegalPage.css'

const DOC_PATH = {
  privacy: { doc: 'privacy', path: '/privacy' },
  terms: { doc: 'terms', path: '/terms' },
  disclaimer: { doc: 'disclaimerPage', path: '/disclaimer' },
}

export default function LegalPage({ kind }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const meta = DOC_PATH[kind] || DOC_PATH.privacy
  const docKey = meta.doc
  const returnPath = legalReturnFromSearch(searchParams)

  const sections = t(`legal.${docKey}.sections`, { returnObjects: true })

  useEffect(() => {
    document.title = `${t(`legal.${docKey}.title`)} · Wenap`
    return () => {
      document.title = 'Wenap'
    }
  }, [t, docKey])

  const docLink = (path) => {
    const q = returnPath ? `?from=${encodeURIComponent(returnPath)}` : ''
    return `${path}${q}`
  }

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <div className="legal-nav-start">
          <Link to="/" className="legal-logo">
            Wenap
          </Link>
          {returnPath ? (
            <Link to={returnPath} className="legal-back-return">
              ← {legalReturnLabel(returnPath, t)}
            </Link>
          ) : null}
        </div>
        <div className="legal-nav-end">
          <div className="legal-nav-links">
            <Link
              to={docLink('/privacy')}
              className={location.pathname === '/privacy' ? 'legal-nav-active' : ''}
            >
              {t('legal.nav.privacy')}
            </Link>
            <Link
              to={docLink('/terms')}
              className={location.pathname === '/terms' ? 'legal-nav-active' : ''}
            >
              {t('legal.nav.terms')}
            </Link>
            <Link
              to={docLink('/disclaimer')}
              className={location.pathname === '/disclaimer' ? 'legal-nav-active' : ''}
            >
              {t('legal.nav.disclaimer')}
            </Link>
          </div>
          {!returnPath ? (
            <div className="legal-nav-auth">
              <Link to="/login">{t('auth.loginBtn')}</Link>
              <Link to="/register" className="legal-nav-auth-cta">
                {t('auth.registerLink')}
              </Link>
            </div>
          ) : null}
          <LanguageSwitcher />
        </div>
      </nav>

      <article className="legal-wrap">
        <h1>{t(`legal.${docKey}.title`)}</h1>
        <p className="legal-meta">{t('legal.lastUpdated', { date: t(`legal.${docKey}.updated`) })}</p>
        <p className="legal-intro">{t(`legal.${docKey}.intro`)}</p>

        {Array.isArray(sections)
          ? sections.map((sec, i) => (
              <section key={i} className="legal-section">
                <h2>{sec.title}</h2>
                {(sec.paragraphs || []).map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </section>
            ))
          : null}

        <div className="legal-footer-bar">
          {returnPath ? (
            <Link to={returnPath} className="legal-footer-primary">
              ← {legalReturnLabel(returnPath, t)}
            </Link>
          ) : null}
          <Link to="/" className={returnPath ? 'legal-footer-secondary' : ''}>
            {t('legal.backHome')}
          </Link>
          <a href="mailto:support@wenap.app">{t('legal.nav.contact')}</a>
        </div>
      </article>
    </div>
  )
}
