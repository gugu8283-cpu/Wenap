import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { legalDocLink } from '../utils/legalReturn.js'

/**
 * Site-wide legal links — use on landing, app, auth, pricing, about, accuracy.
 */
export default function LegalFooter({ className = '', showDisclaimerLine = false, returnTo = '' }) {
  const { t } = useTranslation()

  return (
    <div className={className}>
      {showDisclaimerLine ? (
        <p className="legal-footer-disclaimer">{t('app.disclaimer')}</p>
      ) : null}
      <nav className="legal-footer-links" aria-label={t('legal.nav.all')}>
        <Link to={legalDocLink('/disclaimer', returnTo)}>{t('legal.nav.disclaimer')}</Link>
        <Link to={legalDocLink('/privacy', returnTo)}>{t('legal.nav.privacy')}</Link>
        <Link to={legalDocLink('/terms', returnTo)}>{t('legal.nav.terms')}</Link>
        <a href="mailto:support@wenap.app">{t('legal.nav.contact')}</a>
      </nav>
    </div>
  )
}
