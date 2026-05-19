import { useMemo } from 'react'
import './MobileAnalysisReport.css'
import { normalizeSourcesList } from '../../utils/parseSources.js'

function CredBadge({ level }) {
  const c =
    level === 'high' ? 'ma-cred--high' : level === 'mid' ? 'ma-cred--mid' : 'ma-cred--other'
  const t = level === 'high' ? '高' : level === 'mid' ? '中' : level === 'low' ? '低' : '—'
  return <span className={`ma-cred ${c}`}>{t}</span>
}

function formatSourceDate(raw) {
  const s = String(raw || '').trim()
  if (!s || s === '—' || s.toLowerCase() === 'null') return '日期未知'
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
  return '日期未知'
}

function truncateTitle(title, max = 30) {
  const t = String(title || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}...`
}

export default function SourcesAccordion({ sources, sourceCount, timeSaved }) {
  const list = useMemo(() => normalizeSourcesList(sources), [sources])
  const n = sourceCount ?? list.length ?? 0
  if (!n && !list.length) return null

  return (
    <details className="ma-card ma-sources-card">
      <summary className="ma-sources-summary">
        查看 {n} 个来源 · 约节省 {timeSaved} 小时
      </summary>
      {list.map((s, i) => {
        const dateLine = formatSourceDate(s.date)
        const fullTitle = s.title || s.url || '来源'
        const shortTitle = truncateTitle(fullTitle)
        return (
          <div key={i} className="ma-source-row">
            <CredBadge level={s.credibility} />
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
              <div className="ma-source-meta">
                {s.source} · {dateLine}
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
