import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MobileAnalysisReport from '../components/analysis/MobileAnalysisReport.jsx'
import snapshotToMobileReport from '../utils/snapshotToMobileReport.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const FEATURED = ['NVDA', 'AAPL', 'JPM', 'UNH', 'SPY', 'QQQ', 'VTI', 'O', 'PLD', 'GLD']

export default function SampleReportPage() {
  const { ticker } = useParams()
  const { t, i18n } = useTranslation()
  const sym = (ticker || '').toUpperCase()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sym) return
    setLoading(true)
    setError('')
    const locale = i18n.language || 'en'
    fetch(`${API_BASE}/sample/${encodeURIComponent(sym)}?locale=${locale}`)
      .then((r) => {
        if (!r.ok) throw new Error('NOT_FOUND')
        return r.json()
      })
      .then((data) => {
        const r = snapshotToMobileReport(data.vizSnapshot || data, locale)
        setReport({ ...r, isSample: true })
      })
      .catch((e) => setError(e.message || 'Error'))
      .finally(() => setLoading(false))
  }, [sym, i18n.language])

  // Update OG meta tags dynamically
  useEffect(() => {
    if (!report) return
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
    const score = report.score || 0
    const signal = report.signal || 'BUY'
    const company = report.companyName || sym
    const ogImg = `${API_BASE}/og/${sym}?score=${score}&signal=${signal}&company=${encodeURIComponent(company)}`
    setMeta('og:title', title)
    setMeta('og:description', `AI analysis score: ${score}/100 · Signal: ${signal}`)
    setMeta('og:image', ogImg)
    setMeta('og:type', 'article')
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:image', ogImg)
  }, [report, sym])

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white' }}>
      {/* Nav bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontWeight: 700, fontSize: 22, background: 'linear-gradient(135deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Wenap</span>
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 14 }}>Sign in</Link>
          <Link to="/register" style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: 'white', padding: '6px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            {t('landing.ctaFree') || 'Get started free'}
          </Link>
        </div>
      </div>

      {/* Sample banner */}
      <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, margin: '16px 16px 0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
          {t('sample.banner') || `This is a public sample report for ${sym}. Sign up to run analyses on any ticker.`}
        </span>
        <Link to="/register" style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: 'white', padding: '6px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
          {t('sample.ctaSignup') || 'Try free'}
        </Link>
      </div>

      <div style={{ padding: '8px 0 32px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: 'rgba(255,255,255,0.4)' }}>
            {t('sample.loading') || 'Loading sample report…'}
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
              {error === 'NOT_FOUND'
                ? (t('sample.notFound') || `No sample report available for ${sym} yet. Check back soon.`)
                : (t('sample.error') || 'Failed to load sample report.')}
            </p>
            {FEATURED.map((t2) => (
              <Link key={t2} to={`/sample/${t2}`} style={{ display: 'inline-block', margin: '4px 6px', padding: '6px 14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
                {t2}
              </Link>
            ))}
          </div>
        )}
        {report && !loading && (
          <MobileAnalysisReport report={report} />
        )}
      </div>
    </div>
  )
}
