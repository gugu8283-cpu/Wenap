import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher.jsx'
import './LegalPage.css'

const DOC_PATH = {
  privacy: { doc: 'privacy', path: '/privacy' },
  terms: { doc: 'terms', path: '/terms' },
  disclaimer: { doc: 'disclaimerPage', path: '/disclaimer' },
}

export default function LegalPage({ kind }) {
  const { t } = useTranslation()
  const location = useLocation()
  const meta = DOC_PATH[kind] || DOC_PATH.privacy
  const docKey = meta.doc

  const sections = t(`legal.${docKey}.sections`, { returnObjects: true })

  useEffect(() => {
    document.title = `${t(`legal.${docKey}.title`)} · Wenap`
    return () => {
      document.title = 'Wenap'
    }
  }, [t, docKey])

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/" className="legal-logo">
          Wenap
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="legal-nav-links">
            <Link to="/privacy" className={location.pathname === '/privacy' ? 'legal-nav-active' : ''}>
              {t('legal.nav.privacy')}
            </Link>
            <Link to="/terms" className={location.pathname === '/terms' ? 'legal-nav-active' : ''}>
              {t('legal.nav.terms')}
            </Link>
            <Link to="/disclaimer" className={location.pathname === '/disclaimer' ? 'legal-nav-active' : ''}>
              {t('legal.nav.disclaimer')}
            </Link>
          </div>
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
          <Link to="/">{t('legal.backHome')}</Link>
          <a href="mailto:support@wenap.app">{t('legal.nav.contact')}</a>
        </div>
      </article>
    </div>
  )
}
