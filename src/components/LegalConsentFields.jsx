import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { legalDocLink } from '../utils/legalReturn.js'

/**
 * Explicit per-document consent checkboxes (electronic signature style).
 */
export default function LegalConsentFields({
  agreeTerms,
  agreePrivacy,
  agreeDisclaimer,
  onChangeTerms,
  onChangePrivacy,
  onChangeDisclaimer,
  showSubscription = false,
  agreeSubscription = false,
  onChangeSubscription,
  returnTo = '',
}) {
  const { t, i18n } = useTranslation()
  const isJa = String(i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('ja')

  return (
    <div className="legal-consent-fields">
      <p className="legal-consent-heading">{t('legal.consentHeading')}</p>

      <label className="auth-terms-agree legal-consent-row">
        <input type="checkbox" checked={agreeTerms} onChange={(e) => onChangeTerms(e.target.checked)} />
        <span>
          {t('legal.consentTermsPrefix')}{' '}
          <Link to={legalDocLink('/terms', returnTo)}>
            {t('legal.nav.terms')}
          </Link>
          {t('legal.consentTermsSuffix')}
        </span>
      </label>

      <label className="auth-terms-agree legal-consent-row">
        <input type="checkbox" checked={agreePrivacy} onChange={(e) => onChangePrivacy(e.target.checked)} />
        <span>
          {t('legal.consentPrivacyPrefix')}{' '}
          <Link to={legalDocLink('/privacy', returnTo)}>
            {t('legal.nav.privacy')}
          </Link>
          {t('legal.consentPrivacySuffix')}
        </span>
      </label>

      <label className="auth-terms-agree legal-consent-row">
        <input
          type="checkbox"
          checked={agreeDisclaimer}
          onChange={(e) => onChangeDisclaimer(e.target.checked)}
        />
        <span>
          {t('legal.consentDisclaimerPrefix')}{' '}
          <Link to={legalDocLink('/disclaimer', returnTo)}>
            {t('legal.nav.disclaimer')}
          </Link>
          {t('legal.consentDisclaimerSuffix')}
        </span>
      </label>

      {showSubscription ? (
        <label className="auth-terms-agree legal-consent-row legal-consent-row--sub">
          <input
            type="checkbox"
            checked={agreeSubscription}
            onChange={(e) => onChangeSubscription(e.target.checked)}
          />
          <span>
            {t('legal.consentSubscriptionPrefix')}{' '}
            <Link to={legalDocLink('/terms', returnTo)}>
              {t('legal.nav.terms')}
            </Link>
            {t('legal.consentSubscriptionSuffix')}
          </span>
        </label>
      ) : null}

      <p className="legal-consent-note">{t('legal.consentAuditNote')}</p>
      {isJa ? <p className="legal-consent-note">{t('legal.jaFsaRegistration')}</p> : null}
    </div>
  )
}

export function allRegistrationConsents({ agreeTerms, agreePrivacy, agreeDisclaimer }) {
  return agreeTerms && agreePrivacy && agreeDisclaimer
}
