import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import LegalFooter from '../components/LegalFooter.jsx'
import LandingHeroPreview from '../components/LandingHeroPreview.jsx'
import '../components/LegalFooter.css'
import './LandingPage.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function RadarChartIcon() {
  return (
    <svg className="landing-radar-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 12 L12 2.5 A9.5 9.5 0 0 1 19.2 7.8 Z" fill="currentColor" opacity="0.45" />
      <line x1="12" y1="12" x2="12" y2="2.5" stroke="currentColor" strokeWidth="1" />
      <line x1="12" y1="12" x2="19.5" y2="12" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
      <line x1="12" y1="12" x2="4.5" y2="12" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
      <line x1="12" y1="12" x2="12" y2="21.5" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
    </svg>
  )
}

const FEATURE_TIERS = [
  { icon: '⚡', key: 'featureFast' },
  { icon: '🎯', key: 'featureScenario' },
  { icon: 'radar', key: 'featureSix' },
  { icon: '🔗', key: 'featureSupply' },
  { icon: '📊', key: 'featureAccuracy' },
  { icon: '🌍', key: 'featureLanguages' },
]

const PRICING_TEASERS = [
  { id: 'free', nameKey: 'pricing.freeName', priceKey: 'pricing.freePrice', featuresKey: 'landing.freeFeatures', ctaClass: 'landing-tier-cta--free', to: '/register', ctaKey: 'landing.getStarted' },
  { id: 'pro', name: 'Pro', priceKey: 'pricing.proPrice', featuresKey: 'landing.proFeatures', cardClass: 'landing-tier-card--pro', to: '/pricing', ctaKey: 'landing.upgradeBtn' },
  { id: 'pro_plus', name: 'Pro+', priceKey: 'pricing.proPlusPrice', featuresKey: 'landing.proPlusFeatures', cardClass: 'landing-tier-card--proplus', badgeKey: 'pricing.mostPopular', to: '/pricing', ctaKey: 'landing.upgradeBtn' },
]

const SAMPLE_TICKERS = ['NVDA', 'AAPL', 'JPM', 'SPY', 'QQQ']

function TierFeatureList({ featuresKey, t }) {
  const items = t(featuresKey, { returnObjects: true })
  if (!Array.isArray(items)) return null
  return (
    <ul className="landing-tier-features">
      {items.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

export default function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accuracy, setAccuracy] = useState(null)
  const [ticker, setTicker] = useState('')

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      const tier = searchParams.get('tier')
      const q = tier ? `?checkout=success&tier=${encodeURIComponent(tier)}` : '?checkout=success'
      navigate(`/app${q}`, { replace: true })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    fetch(`${API_BASE}/accuracy/stats`)
      .then((r) => r.json())
      .then((j) => setAccuracy(j))
      .catch(() => {})
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    const sym = ticker.trim().toUpperCase()
    if (sym) {
      navigate(`/register?symbol=${encodeURIComponent(sym)}`)
    } else {
      navigate('/register')
    }
  }

  const reportIncludes = t('landing.reportIncludes', { returnObjects: true })
  const hasAccuracy = accuracy && accuracy.total > 0
  const accuracyPct = hasAccuracy
    ? (accuracy.buySignalWinRate30d ?? accuracy.pct_correct ?? accuracy.tendencyAccuracy ?? '—')
    : null

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-logo">W<span>enap</span></div>
        <div className="landing-nav-right">
          <LanguageSwitcher />
          <Link to="/sample/NVDA" className="landing-nav-link">{t('landing.trySampleNav')}</Link>
          <Link to="/login" className="landing-nav-link">{t('landing.signIn')}</Link>
          <Link to="/register" className="landing-nav-cta">{t('landing.getStarted')}</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-layout">
          <div className="landing-hero-copy">
            <div className="landing-kicker">{t('landing.kicker')}</div>
            <h1 className="landing-headline">{t('landing.headline')}</h1>
            <p className="landing-subheadline">{t('landing.subheadline')}</p>
            <p className="landing-timing-note">{t('landing.timingNote')}</p>

            {Array.isArray(reportIncludes) && reportIncludes.length > 0 ? (
              <ul className="landing-report-includes">
                {reportIncludes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}

            <div className="landing-accuracy-pill">
              {hasAccuracy ? (
                <>
                  <span className="landing-accuracy-num">{accuracyPct}%</span>
                  <span className="landing-accuracy-label">
                    {t('landing.accuracyLabel', { count: accuracy.total })}
                  </span>
                </>
              ) : (
                <span className="landing-accuracy-label">{t('landing.accuracyFallback')}</span>
              )}
              <Link to="/accuracy" className="landing-accuracy-link">→</Link>
            </div>

            <form className="landing-search" onSubmit={handleSearch}>
              <input
                className="landing-search-input"
                type="text"
                placeholder={t('landing.searchPlaceholder')}
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="landing-search-btn">
                {t('landing.analyzeBtn')}
              </button>
            </form>

            <div className="landing-hero-actions">
              <Link to="/sample/NVDA" className="landing-sample-cta">
                {t('landing.trySampleCta')}
              </Link>
              <span className="landing-sample-hint">{t('landing.trySampleHint')}</span>
            </div>

            <p className="landing-fine">{t('landing.fineprint')}</p>
            <p className="landing-trust-note">{t('landing.trustNote')}</p>
          </div>

          <Link to="/sample/NVDA" className="landing-hero-preview-link" aria-label={t('landing.trySampleCta')}>
            <LandingHeroPreview />
            <span className="landing-hero-preview-caption">{t('landing.previewCaption')}</span>
          </Link>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="landing-section-title">{t('landing.featuresTitle')}</h2>
        <div className="landing-features-grid">
          {FEATURE_TIERS.map((f) => (
            <div key={f.key} className="landing-feature-card">
              <span className="landing-feature-icon">
                {f.icon === 'radar' ? <RadarChartIcon /> : f.icon}
              </span>
              <div>
                <strong>{t(`landing.${f.key}Title`)}</strong>
                <p>{t(`landing.${f.key}Sub`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-pricing-teaser">
        <h2 className="landing-section-title">{t('landing.pricingTitle')}</h2>
        <div className="landing-tier-grid">
          {PRICING_TEASERS.map((plan) => (
            <div key={plan.id} className={`landing-tier-card${plan.cardClass ? ` ${plan.cardClass}` : ''}`}>
              {plan.badgeKey ? <div className="landing-tier-badge">{t(plan.badgeKey)}</div> : null}
              <div className="landing-tier-name">{plan.nameKey ? t(plan.nameKey) : plan.name}</div>
              <div className="landing-tier-price">{t(plan.priceKey)}</div>
              <TierFeatureList featuresKey={plan.featuresKey} t={t} />
              <Link
                to={plan.to}
                className={`landing-tier-cta${plan.ctaClass ? ` ${plan.ctaClass}` : ''}${plan.id === 'pro_plus' ? ' landing-tier-cta--proplus' : ''}`}
              >
                {t(plan.ctaKey)}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-samples">
        <h2 className="landing-section-title">{t('landing.sampleTitle')}</h2>
        <p className="landing-section-sub">{t('landing.sampleNote')}</p>
        <div className="landing-sample-chips">
          {SAMPLE_TICKERS.map((sym) => (
            <Link key={sym} to={`/sample/${sym}`} className="landing-sample-chip">
              {sym}
            </Link>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <LegalFooter showDisclaimerLine className="landing-legal-footer" />
        <div className="landing-footer-links">
          <Link to="/accuracy">{t('app.accuracyLink')}</Link>
          <Link to="/about">{t('landing.aboutLink')}</Link>
          <Link to="/login">{t('landing.signIn')}</Link>
          <Link to="/pricing">{t('pricing.title')}</Link>
        </div>
      </footer>
    </div>
  )
}
