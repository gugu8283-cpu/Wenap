import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher.jsx'
import MobileAnalysisReport from '../components/analysis/MobileAnalysisReport.jsx'
import { resolveAppLanguage } from '../i18n/index.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const FEATURED = ['NVDA', 'AAPL', 'JPM', 'UNH', 'SPY', 'QQQ', 'VTI', 'O', 'PLD', 'GLD']
/** Public samples are generated in English; default UI to en to avoid mixed zh/en. */
const SAMPLE_DEFAULT_LOCALE = 'en'

export default function SampleReportPage() {
  const { ticker } = useParams()
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const sym = (ticker || '').toUpperCase()

  const sampleLocale = resolveAppLanguage(
    searchParams.get('lang') || searchParams.get('locale') || SAMPLE_DEFAULT_LOCALE,
  )

  const [vizSnapshot, setVizSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Ensure URL carries lang= so refresh/share stays consistent (default en).
  useEffect(() => {
    if (searchParams.get('lang') || searchParams.get('locale')) return
    setSearchParams({ lang: SAMPLE_DEFAULT_LOCALE }, { replace: true })
  }, [searchParams, setSearchParams])

  // Keep UI labels aligned with sample fetch locale (ignore saved zh from main app).
  useEffect(() => {
    if (resolveAppLanguage(i18n.language) !== sampleLocale) {
      i18n.changeLanguage(sampleLocale)
    }
  }, [sampleLocale, i18n])

  // Language switcher → update ?lang= and refetch sample.
  useEffect(() => {
    const onLang = (lng) => {
      const norm = resolveAppLanguage(lng)
      if (searchParams.get('lang') !== norm) {
        setSearchParams({ lang: norm }, { replace: true })
      }
    }
    i18n.on('languageChanged', onLang)
    return () => i18n.off('languageChanged', onLang)
  }, [i18n, searchParams, setSearchParams])

  useEffect(() => {
    if (!sym) return
    setLoading(true)
    setError('')
    fetch(`${API_BASE}/sample/${encodeURIComponent(sym)}?locale=${encodeURIComponent(sampleLocale)}`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => {
        if (!r.ok) throw new Error('NOT_FOUND')
        return r.json()
      })
      .then((data) => {
        setVizSnapshot(data.vizSnapshot || data)
      })
      .catch((e) => setError(e.message || 'Error'))
      .finally(() => setLoading(false))
  }, [sym, sampleLocale])

  useEffect(() => {
    if (!vizSnapshot) return
    const title = `${sym} Analysis – Wenap`
    document.title = title
    const setMeta = (property, content) => {
      let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`)
      if (!el) {
        el = document.createElement('meta')
        if (property.startsWith('og:') || property.startsWith('twitter:')) el.setAttribute('property', property)
        else el.setAttribute('name', property)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }
    const score = vizSnapshot.score ?? vizSnapshot.overallScore ?? 0
    const signal = vizSnapshot.signal || vizSnapshot.actionSignal || 'BUY'
    const company = vizSnapshot.companyName || sym
    const ogImg = `${API_BASE}/og/${sym}?score=${score}&signal=${signal}&company=${encodeURIComponent(company)}`
    setMeta('og:title', title)
    setMeta('og:description', `AI analysis score: ${score}/100 · Signal: ${signal}`)
    setMeta('og:image', ogImg)
    setMeta('og:type', 'article')
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:image', ogImg)
  }, [vizSnapshot, sym])

  const showMixedLocaleNote = sampleLocale !== SAMPLE_DEFAULT_LOCALE

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: 12 }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontWeight: 700, fontSize: 22, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Wenap</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <LanguageSwitcher />
          <Link to="/login" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 14 }}>{t('landing.signIn')}</Link>
          <Link to="/register" style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: 'white', padding: '6px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            {t('landing.getStarted')}
          </Link>
        </div>
      </div>

      <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, margin: '16px 16px 0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
          {t('sample.banner')}
        </span>
        <Link to="/register" style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: 'white', padding: '6px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {t('sample.ctaSignup')}
        </Link>
      </div>

      {showMixedLocaleNote ? (
        <p style={{ margin: '12px 16px 0', fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          {t('sample.mixedLocaleNote')}
        </p>
      ) : null}

      <div style={{ padding: '8px 0 32px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: 'rgba(255,255,255,0.4)' }}>
            {t('sample.loading')}
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
              {error === 'NOT_FOUND' ? t('sample.notFound') : t('sample.error')}
            </p>
            {FEATURED.map((t2) => (
              <Link
                key={t2}
                to={`/sample/${t2}?lang=${sampleLocale}`}
                style={{ display: 'inline-block', margin: '4px 6px', padding: '6px 14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}
              >
                {t2}
              </Link>
            ))}
          </div>
        )}
        {vizSnapshot && !loading && (
          <MobileAnalysisReport
            snapshot={vizSnapshot}
            meta={{ ticker: sym }}
            ticker={sym}
          />
        )}
      </div>
    </div>
  )
}
