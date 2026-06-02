import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api.js'
import './ProAdvancedPanel.css'

export default function ProAdvancedPanel({ ticker, tier }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [insider, setInsider] = useState(null)
  const [congress, setCongress] = useState(null)
  const [loading, setLoading] = useState(false)
  const sym = String(ticker || '').trim().toUpperCase()
  const isProPlus = tier === 'pro_plus' || tier === 'proplus'

  useEffect(() => {
    if (!open || !isProPlus || !sym) return undefined
    let cancelled = false
    setLoading(true)
    Promise.all([
      apiFetch(`/pro/insider/${encodeURIComponent(sym)}`).catch(() => null),
      apiFetch(`/pro/congress/${encodeURIComponent(sym)}`).catch(() => null),
    ])
      .then(([ins, cong]) => {
        if (cancelled) return
        setInsider(ins)
        setCongress(cong)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, isProPlus, sym])

  if (!isProPlus) return null

  return (
    <section className="pro-advanced-panel">
      <button type="button" className="pro-advanced-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▼' : '▶'} {t('report.advancedProPlus')}
      </button>
      {open ? (
        <div className="pro-advanced-body">
          <p className="pro-advanced-note">{t('report.advancedDisclaimer')}</p>
          {loading ? <p className="pro-advanced-muted">{t('common.loading')}</p> : null}
          {insider?.filings?.length ? (
            <div>
              <h4>{t('report.insiderFilings')}</h4>
              <ul>
                {insider.filings.slice(0, 5).map((f) => (
                  <li key={f.accessionNumber}>
                    {f.form} · {f.filingDate}
                  </li>
                ))}
              </ul>
              <p className="pro-advanced-source">
                {t('report.dataSource')}: {insider.source}{' '}
                <a href={insider.sourceUrl} target="_blank" rel="noopener noreferrer">
                  SEC ↗
                </a>
              </p>
            </div>
          ) : null}
          {congress?.trades?.length ? (
            <div>
              <h4>{t('report.congressTrades')}</h4>
              <ul>
                {congress.trades.slice(0, 5).map((tr, i) => (
                  <li key={`${tr.representative}-${i}`}>
                    {tr.representative} · {tr.type} · {tr.transactionDate || tr.disclosureDate}
                  </li>
                ))}
              </ul>
              <p className="pro-advanced-source">
                {t('report.dataSource')}: {congress.source}
              </p>
            </div>
          ) : null}
          <Link to="/screener" className="pro-advanced-link">
            {t('tools.screenerLink')} →
          </Link>
        </div>
      ) : null}
    </section>
  )
}
