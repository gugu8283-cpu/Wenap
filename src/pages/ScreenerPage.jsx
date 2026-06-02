import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import './ScreenerPage.css'

export default function ScreenerPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const tier = user?.tier || 'free'
  const isProPlus = tier === 'pro_plus' || tier === 'proplus'

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    if (!isProPlus) return
    apiFetch('/pro/screener/usage')
      .then(setUsage)
      .catch(() => {})
  }, [isProPlus])

  async function runScreener(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const j = await apiFetch('/pro/screener', {
        method: 'POST',
        body: JSON.stringify({ query: query.trim() }),
      })
      setResult(j)
      if (j.usage) setUsage(j.usage)
    } catch (err) {
      setError(err?.message || t('screener.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!isProPlus) {
    return (
      <div className="screener-page screener-page--locked">
        <h1>{t('screener.title')}</h1>
        <p>{t('screener.locked')}</p>
        <Link to="/pricing">{t('screener.upgrade')}</Link>
      </div>
    )
  }

  return (
    <div className="screener-page">
      <Link to="/tools" className="screener-back">
        ← {t('screener.back')}
      </Link>
      <h1>{t('screener.title')}</h1>
      <p className="screener-disclaimer">{t('screener.disclaimer')}</p>
      {usage ? (
        <p className="screener-usage">
          {t('screener.usage', { remaining: usage.remaining, cap: usage.cap })}
        </p>
      ) : null}
      <form onSubmit={runScreener} className="screener-form">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('screener.placeholder')}
          rows={4}
          maxLength={500}
        />
        <button type="submit" disabled={loading}>
          {loading ? t('screener.running') : t('screener.run')}
        </button>
      </form>
      {error ? <p className="screener-error">{error}</p> : null}
      {result?.picks?.length ? (
        <ul className="screener-picks">
          {result.picks.map((p) => (
            <li key={p.symbol}>
              <strong>{p.symbol}</strong>
              <p>{p.reason}</p>
              {p.sourceHint ? <span className="screener-hint">{p.sourceHint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {result?.disclaimer ? <p className="screener-foot">{result.disclaimer}</p> : null}
    </div>
  )
}
