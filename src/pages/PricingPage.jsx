import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import LegalFooter from '../components/LegalFooter.jsx'
import '../components/LegalFooter.css'
import './PricingPage.css'

const PLANS = [
  {
    id: 'free',
    tier: 'free',
    features: [
      'pricing.freeFeature1',
      'pricing.freeFeature2',
      'pricing.freeFeature3',
      'pricing.freeFeature4',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    tier: 'pro',
    features: [
      'pricing.proFeature1',
      'pricing.proFeature2',
      'pricing.proFeature3',
      'pricing.proFeature4',
      'pricing.proFeature5',
      'pricing.proFeature6',
    ],
    highlight: false,
  },
  {
    id: 'pro_plus',
    tier: 'pro_plus',
    features: [
      'pricing.proPlusFeature1',
      'pricing.proPlusFeature2',
      'pricing.proPlusFeature3',
      'pricing.proPlusFeature4',
      'pricing.proPlusFeature5',
      'pricing.proPlusFeature6',
      'pricing.proPlusFeature7',
    ],
    highlight: true,
  },
]

export default function PricingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [loadingTier, setLoadingTier] = useState(null)
  const [error, setError] = useState('')
  const [social, setSocial] = useState(null)
  const [agreeSubscription, setAgreeSubscription] = useState(false)

  const checkoutStatus = searchParams.get('checkout')

  useEffect(() => {
    if (checkoutStatus === 'success') {
      navigate('/', { replace: true })
    }
  }, [checkoutStatus, navigate])

  useEffect(() => {
    const base = API_BASE.replace(/\/$/, '')
    fetch(`${base}/stats/social-proof`)
      .then((r) => r.json())
      .then(setSocial)
      .catch(() => {})
  }, [])

  async function handleUpgrade(tier) {
    if (!user) {
      navigate('/register')
      return
    }
    if (!agreeSubscription) {
      setError(t('legal.subscriptionMustAgree'))
      return
    }
    setLoadingTier(tier)
    setError('')
    try {
      const j = await apiFetch('/billing/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ tier, agreeSubscriptionTerms: true }),
      })
      if (j.url) {
        window.location.href = j.url
      } else if (j.error === 'STRIPE_NOT_CONFIGURED') {
        setError(t('pricing.stripeNotConfigured', { email: 'support@wenap.app' }))
      }
    } catch (e) {
      if (e.code === 'LEGAL_REACCEPT_REQUIRED') {
        navigate('/accept-legal')
        return
      }
      if (e.code === 'ACTIVE_SUBSCRIPTION_USE_PORTAL' && e.data?.url) {
        window.location.href = e.data.url
        return
      }
      if (e.code === 'SUBSCRIPTION_CONSENT_REQUIRED') {
        setError(t('legal.subscriptionMustAgree'))
      } else {
        setError(e?.message || t('pricing.upgradeError'))
      }
    } finally {
      setLoadingTier(null)
    }
  }

  return (
    <div className="pricing-page">
      <div className="pricing-top">
        <Link to="/" className="pricing-back">← {t('pricing.backToApp')}</Link>
      </div>
      <div className="pricing-hero">
        <h1 className="pricing-title">{t('pricing.title')}</h1>
        <p className="pricing-sub">{t('pricing.sub')}</p>
        <p className="pricing-sub">{t('pricing.readingTimeHint')}</p>
        <p className="pricing-vs-chatgpt">{t('pricing.vsChatGpt')}</p>
        {social?.usersTotal > 0 ? (
          <p className="pricing-social">{t('convert.upgradeUsers', { count: social.usersTotal })}</p>
        ) : null}
      </div>

      {error && <p className="pricing-error">{error}</p>}

      {user ? (
        <div className="pricing-consent-box">
          <label className="auth-terms-agree legal-consent-row">
            <input
              type="checkbox"
              checked={agreeSubscription}
              onChange={(e) => setAgreeSubscription(e.target.checked)}
            />
            <span>
              {t('legal.consentSubscriptionPrefix')}{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer">
                {t('legal.nav.terms')}
              </Link>
              {t('legal.consentSubscriptionSuffix')}
            </span>
          </label>
        </div>
      ) : null}

      <div className="pricing-grid">
        {PLANS.map((plan) => {
          const isCurrent = user?.tier === plan.tier
          const isUpgrade = plan.tier !== 'free'
          const loading = loadingTier === plan.tier
          return (
            <div
              key={plan.id}
              className={`pricing-card${plan.highlight ? ' pricing-card--highlight' : ''}${isCurrent ? ' pricing-card--current' : ''}`}
            >
              {plan.highlight && (
                <div className="pricing-badge">{t('pricing.mostPopular')}</div>
              )}
              <div className="pricing-plan-name">{t(`pricing.${plan.id}Name`)}</div>
              <div className="pricing-price">
                {plan.tier === 'free'
                  ? t('pricing.freePrice')
                  : plan.tier === 'pro'
                  ? t('pricing.proPrice')
                  : t('pricing.proPlusPrice')}
              </div>
              <ul className="pricing-features">
                {plan.features.map((f) => (
                  <li key={f}>{t(f)}</li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="pricing-current-badge">{t('pricing.currentPlan')}</div>
              ) : isUpgrade ? (
                <button
                  type="button"
                  className={`pricing-cta${plan.highlight ? ' pricing-cta--highlight' : ''}`}
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={Boolean(loadingTier)}
                >
                  {loading ? t('pricing.upgrading') : t('pricing.upgradeBtn', { tier: t(`pricing.${plan.id}Name`) })}
                </button>
              ) : (
                <Link to="/register" className="pricing-cta pricing-cta--free">
                  {t('pricing.getStarted')}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <div className="pricing-faq">
        <h2>{t('pricing.faqTitle')}</h2>
        <details>
          <summary>{t('pricing.faq1Q')}</summary>
          <p>{t('pricing.faq1A')}</p>
        </details>
        <details>
          <summary>{t('pricing.faq2Q')}</summary>
          <p>{t('pricing.faq2A')}</p>
        </details>
        <details>
          <summary>{t('pricing.faq3Q')}</summary>
          <p>{t('pricing.faq3A')}</p>
        </details>
      </div>

      <p className="pricing-legal-note">{t('pricing.legalNote')}</p>
      <LegalFooter showDisclaimerLine className="pricing-legal-footer" returnTo={returnTo} />
    </div>
  )
}
