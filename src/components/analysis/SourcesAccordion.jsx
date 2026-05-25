import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ExpandableText from './ExpandableText.jsx'
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

function isStaleSourceDate(raw, title = '') {
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
  const policyLike = /政策|监管|禁令|出口|合规|regulat|sanction|export control/i.test(title)
  const maxDays = policyLike ? 7 : 14
  return Date.now() - d.getTime() > maxDays * 24 * 60 * 60 * 1000
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

export default function SourcesAccordion({ sources, sourceCount, timeSaved }) {
  const { t } = useTranslation()
  const list = useMemo(() => normalizeSourcesList(sources), [sources])
  const n = sourceCount ?? list.length ?? 0
  if (!n && !list.length) return null

  return (
    <details className="ma-card ma-sources-card">
      <summary className="ma-sources-summary">
        {t('report.sourcesSummaryLoss', { count: n, hours: timeSaved ?? 3 })}
      </summary>
      {list.map((s, i) => {
        const dateLine = formatSourceDate(s.date, t)
        const stale =
          isStaleSourceDate(s.date, s.title) ||
          /⚠️|可能过时|may be stale|无日期|undated/i.test(s.title || '')
        const fullTitle = s.title || s.url || t('report.sourceFallback', { defaultValue: 'Source' })
        return (
          <div key={i} className="ma-source-row">
            <CredBadge level={s.credibility} t={t} />
            <div className="ma-source-main">
              <ExpandableText
                text={fullTitle}
                className="ma-source-title"
                collapsedLines={2}
                minChars={72}
              />
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ma-source-inline-open"
                >
                  {t('report.openSource')}
                </a>
              ) : null}
              <div className={`ma-source-meta${stale ? ' ma-source-meta--stale' : ''}`}>
                {s.source} · {dateLine}
                {stale ? ` · ${t('report.sourceStale')}` : ''}
              </div>
            </div>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ma-source-arrow"
                aria-label={t('report.openSource')}
              >
                ↗
              </a>
            ) : (
              <span className="ma-source-arrow" aria-hidden>
                ↗
              </span>
            )}
          </div>
        )
      })}
    </details>
  )
}
