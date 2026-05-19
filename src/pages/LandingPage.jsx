import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import './LandingPage.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const DEMO_TICKER = 'NVDA'

const FEATURE_TIERS = [
  { icon: '⚡', key: 'featureFast' },
  { icon: '🎯', key: 'featureScenario' },
  { icon: '🔬', key: 'featureSix' },
  { icon: '🔗', key: 'featureSupply' },
  { icon: '📊', key: 'featureAccuracy' },
  { icon: '🌍', key: 'featureLanguages' },
]

export default function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [accuracy, setAccuracy] = useState(null)
  const [ticker, setTicker] = useState('')

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

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-logo">W<span>enap</span></div>
        <div className="landing-nav-right">
          <LanguageSwitcher />
          <Link to="/login" className="landing-nav-link">{t('landing.signIn')}</Link>
          <Link to="/register" className="landing-nav-cta">{t('landing.getStarted')}</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-kicker">{t('landing.kicker')}</div>
          <h1 className="landing-headline">{t('landing.headline')}</h1>
          <p className="landing-subheadline">{t('landing.subheadline')}</p>

          {accuracy && accuracy.total > 0 ? (
            <div className="landing-accuracy-pill">
              <span className="landing-accuracy-num">{accuracy.pct_correct ?? '—'}%</span>
              <span className="landing-accuracy-label">
                {t('landing.accuracyLabel', { count: accuracy.total })}
              </span>
              <Link to="/accuracy" className="landing-accuracy-link">→</Link>
            </div>
          ) : null}

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

          <p className="landing-fine">
            {t('landing.fineprint')}
          </p>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="landing-section-title">{t('landing.featuresTitle')}</h2>
        <div className="landing-features-grid">
          {FEATURE_TIERS.map((f) => (
            <div key={f.key} className="landing-feature-card">
              <span className="landing-feature-icon">{f.icon}</span>
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
          <div className="landing-tier-card">
            <div className="landing-tier-name">{t('pricing.freeName')}</div>
            <div className="landing-tier-price">{t('pricing.freePrice')}</div>
            <p className="landing-tier-desc">{t('landing.freeDesc')}</p>
            <Link to="/register" className="landing-tier-cta landing-tier-cta--free">{t('landing.getStarted')}</Link>
          </div>
          <div className="landing-tier-card landing-tier-card--pro">
            <div className="landing-tier-name">Pro</div>
            <div className="landing-tier-price">{t('pricing.proPrice')}</div>
            <p className="landing-tier-desc">{t('landing.proDesc')}</p>
            <Link to="/pricing" className="landing-tier-cta">{t('landing.upgradeBtn')}</Link>
          </div>
          <div className="landing-tier-card landing-tier-card--proplus">
            <div className="landing-tier-badge">{t('pricing.mostPopular')}</div>
            <div className="landing-tier-name">Pro+</div>
            <div className="landing-tier-price">{t('pricing.proPlusPrice')}</div>
            <p className="landing-tier-desc">{t('landing.proPlusDesc')}</p>
            <Link to="/pricing" className="landing-tier-cta landing-tier-cta--proplus">{t('landing.upgradeBtn')}</Link>
          </div>
        </div>
      </section>

      <section className="landing-samples">
        <h2 className="landing-section-title">{t('landing.sampleTitle') || 'Free Sample Reports'}</h2>
        <p className="landing-section-sub" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>{t('landing.sampleNote') || 'See a live AI report — no sign-up required.'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: '0 16px 24px' }}>
          {['NVDA', 'AAPL', 'JPM', 'SPY', 'QQQ'].map((sym) => (
            <Link key={sym} to={`/sample/${sym}`} style={{ display: 'inline-block', padding: '8px 18px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
              {sym}
            </Link>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p>{t('app.disclaimer')}</p>
        <div className="landing-footer-links">
          <Link to="/accuracy">{t('app.accuracyLink')}</Link>
          <Link to="/login">{t('landing.signIn')}</Link>
          <Link to="/pricing">{t('pricing.title')}</Link>
        </div>
      </footer>
    </div>
  )
}
