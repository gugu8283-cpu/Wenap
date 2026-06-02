import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import './ToolsPage.css'

function readMacroCountry() {
  try {
    const v = localStorage.getItem('wenap_macroCountry')
    if (v && /^[A-Za-z]{2,3}$/.test(v)) return v.toUpperCase()
  } catch {
    /* ignore */
  }
  return 'USA'
}

export default function ToolsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const tier = user?.tier || 'free'
  const isPro = tier === 'pro' || tier === 'pro_plus' || tier === 'proplus'
  const isProPlus = tier === 'pro_plus' || tier === 'proplus'
  const [macroCountry, setMacroCountry] = useState(readMacroCountry())

  useEffect(() => {
    try {
      localStorage.setItem('wenap_macroCountry', macroCountry)
    } catch {
      /* ignore */
    }
  }, [macroCountry])

  return (
    <div className="tools-page">
      <Link to="/app" className="tools-back">
        ← {t('tools.back')}
      </Link>
      <h1>{t('tools.title')}</h1>
      <p className="tools-sub">{t('tools.sub')}</p>

      {isPro ? (
        <div className="tools-macro-bar">
          <label className="tools-macro-label">
            {t('tools.macroCountry')}
            <input
              className="tools-macro-input"
              value={macroCountry}
              onChange={(e) =>
                setMacroCountry(
                  String(e.target.value || '')
                    .toUpperCase()
                    .replace(/[^A-Z]/g, '')
                    .slice(0, 3),
                )
              }
              placeholder="USA"
              maxLength={3}
            />
          </label>
          <div className="tools-macro-hint">{t('tools.macroCountryHint')}</div>
        </div>
      ) : null}

      <div className="tools-grid">
        <Link to="/compare" className={`tools-card${isPro ? '' : ' tools-card--locked'}`}>
          <h2>{t('tools.compare')}</h2>
          <p>{t('tools.compareDesc')}</p>
          {!isPro ? <span className="tools-badge">Pro</span> : null}
        </Link>

        <div className={`tools-card${isPro ? '' : ' tools-card--locked'}`}>
          <h2>{t('tools.macro')}</h2>
          <p>{t('tools.macroDesc')}</p>
          {isPro ? (
            <Link to="/app?macro=1" className="tools-cta">
              {t('tools.openInApp')}
            </Link>
          ) : (
            <span className="tools-badge">Pro</span>
          )}
        </div>

        <Link to="/screener" className={`tools-card${isProPlus ? '' : ' tools-card--locked'}`}>
          <h2>{t('tools.screener')}</h2>
          <p>{t('tools.screenerDesc')}</p>
          {!isProPlus ? <span className="tools-badge">Pro+</span> : null}
        </Link>

        <Link to="/settings#alerts" className={`tools-card${isProPlus ? '' : ' tools-card--locked'}`}>
          <h2>{t('tools.alerts')}</h2>
          <p>{t('tools.alertsDesc')}</p>
          {!isProPlus ? <span className="tools-badge">Pro+</span> : null}
        </Link>
      </div>

      <p className="tools-foot">{t('tools.usEquityNote')}</p>
    </div>
  )
}
