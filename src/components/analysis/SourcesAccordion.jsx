import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import { normalizeSourcesList } from '../../utils/parseSources.js'

function CredBadge({ level, t }) {
  const c =
    level === 'high' ? 'ma-cred--high' : level === 'mid' ? 'ma-cred--mid' : 'ma-cred--other'
  const label =
    level === 'high'
      ? t('report.credHigh')
      : level === 'mid'
        ? t('report.credMid')
        : level === 'low'
          ? t('report.credLow')
          : '—'
  return <span className={`ma-cred ${c}`}>{label}</span>
}

function isStaleSourceDate(raw) {
  const s = String(raw || '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  let d
  if (m) d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`)
  else {
    try {
      d = new Date(s)
    } catch {
      return false
    }
  }
  if (!d || Number.isNaN(d.getTime())) return false
  return Date.now() - d.getTime() > 14 * 24 * 60 * 60 * 1000
}

function formatSourceDate(raw, t) {
  const s = String(raw || '').trim()
  if (!s || s === '—' || s.toLowerCase() === 'null') return t('report.dateUnknown')
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  try {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  } catch {
    /* ignore */
  }
  return t('report.dateUnknown')
}

function truncateTitle(title, max = 30) {
  const t = String(title || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}...`
}

export default function SourcesAccordion({ sources, sourceCount, timeSaved }) {
  const { t } = useTranslation()
  const list = useMemo(() => normalizeSourcesList(sources), [sources])
  const n = sourceCount ?? list.length ?? 0
  if (!n && !list.length) return null

  return (
    <details className="ma-card ma-sources-card">
      <summary className="ma-sources-summary">
        {t('report.sourcesSummary', { count: n, hours: timeSaved ?? 1 })}
      </summary>
      {list.map((s, i) => {
        const dateLine = formatSourceDate(s.date, t)
        const stale = isStaleSourceDate(s.date) || /⚠️|可能过时|may be stale/i.test(s.title || '')
        const fullTitle = s.title || s.url || '来源'
        const shortTitle = truncateTitle(fullTitle)
        return (
          <div key={i} className="ma-source-row">
            <CredBadge level={s.credibility} t={t} />
            <div className="ma-source-main">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ma-source-link"
                  title={fullTitle}
                >
                  {shortTitle}
                </a>
              ) : (
                <span className="ma-source-link" title={fullTitle}>
                  {shortTitle}
                </span>
              )}
              <div className={`ma-source-meta${stale ? ' ma-source-meta--stale' : ''}`}>
                {s.source} · {dateLine}
                {stale ? ` · ${t('report.sourceStale')}` : ''}
              </div>
            </div>
            <span className="ma-source-arrow" aria-hidden>
              ↗
            </span>
          </div>
        )
      })}
    </details>
  )
}
