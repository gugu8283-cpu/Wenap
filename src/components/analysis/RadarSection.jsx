import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useInView } from '../../hooks/useInView.js'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'
import './MobileAnalysisReport.css'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

function readChartTheme() {
  if (typeof document === 'undefined') {
    return {
      gridColor: '#3d4558',
      labelColor: '#a8b0bd',
      fill: 'rgba(77,154,255,0.22)',
      border: '#4d9aff',
    }
  }
  const style = getComputedStyle(document.documentElement)
  const grid = style.getPropertyValue('--radar-grid').trim() || style.getPropertyValue('--border').trim() || '#3d4558'
  const label = style.getPropertyValue('--text-secondary').trim() || '#a8b0bd'
  const fill = style.getPropertyValue('--radar-fill').trim() || 'rgba(55,138,221,0.18)'
  const border = style.getPropertyValue('--radar-border').trim() || '#378add'
  return { gridColor: grid, labelColor: label, fill, border }
}

export default function RadarSection({ dimensions }) {
  const { t } = useTranslation()
  const [openIdx, setOpenIdx] = useState(null)
  const [pendingIdx, setPendingIdx] = useState(null)
  const [themeKey, setThemeKey] = useState(0)
  const [barsAnim, setBarsAnim] = useState(false)
  const chartRef = useRef(null)
  const { ref: sectionRef, inView } = useInView({ threshold: 0.12 })

  const dims = (dimensions || []).slice(0, 6)

  useEffect(() => {
    const root = document.documentElement
    const obs = new MutationObserver(() => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
      setThemeKey((k) => k + 1)
    })
    obs.observe(root, { attributes: true, attributeFilter: ['data-wenap-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (inView) {
      const t = setTimeout(() => setBarsAnim(true), 80)
      return () => clearTimeout(t)
    }
    setBarsAnim(false)
    return undefined
  }, [inView, dims.length])

  const theme = useMemo(() => readChartTheme(), [themeKey])

  const lowestIdx = useMemo(() => {
    if (!dims.length) return -1
    let min = Infinity
    let idx = 0
    dims.forEach((d, i) => {
      if (d.scoreUnavailable || d.score == null || !Number.isFinite(Number(d.score))) return
      const s = Number(d.score)
      if (s < min) {
        min = s
        idx = i
      }
    })
    return min === Infinity ? -1 : idx
  }, [dims])

  const data = useMemo(
    () => ({
      labels: dims.map((d) => d.name),
      datasets: [
        {
          data: dims.map((d) =>
            d.scoreUnavailable || d.score == null || !Number.isFinite(Number(d.score))
              ? null
              : Number(d.score),
          ),
          backgroundColor: (ctx) => {
            const d = dims[ctx.dataIndex]
            return d?.scoreUnavailable ? 'rgba(107, 114, 128, 0.12)' : theme.fill
          },
          borderColor: (ctx) => {
            const d = dims[ctx.dataIndex]
            return d?.scoreUnavailable ? 'rgba(107, 114, 128, 0.55)' : theme.border
          },
          borderWidth: 2,
          borderDash: (ctx) => (dims[ctx.dataIndex]?.scoreUnavailable ? [6, 4] : []),
          pointRadius: (ctx) => (dims[ctx.dataIndex]?.scoreUnavailable ? 5 : 2),
          pointBackgroundColor: (ctx) => {
            const d = dims[ctx.dataIndex]
            return d?.scoreUnavailable ? 'rgba(107, 114, 128, 0.35)' : theme.border
          },
          pointBorderColor: (ctx) => {
            const d = dims[ctx.dataIndex]
            return d?.scoreUnavailable ? 'rgba(156, 163, 175, 0.9)' : theme.border
          },
          spanGaps: false,
        },
      ],
    }),
    [dims, theme],
  )

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: theme.gridColor },
          angleLines: { color: theme.gridColor },
          pointLabels: { font: { size: 11 }, color: theme.labelColor },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    }),
    [theme],
  )

  const handleRowClick = useCallback(
    (i) => {
      if (openIdx === i) {
        setOpenIdx(null)
        setPendingIdx(null)
        return
      }
      if (openIdx !== null) {
        setPendingIdx(i)
        setOpenIdx(null)
      } else {
        setOpenIdx(i)
      }
    },
    [openIdx],
  )

  useEffect(() => {
    if (openIdx !== null || pendingIdx === null) return undefined
    const t = setTimeout(() => {
      setOpenIdx(pendingIdx)
      setPendingIdx(null)
    }, 200)
    return () => clearTimeout(t)
  }, [openIdx, pendingIdx])

  if (dims.length < 3) return null

  return (
    <div ref={sectionRef} className="ma-card ma-radar-card">
      <h2 className="ma-section-title">{t('report.radar')}</h2>
      <div className="ma-radar-wrap">
        <Radar
          key={themeKey}
          ref={chartRef}
          data={data}
          options={options}
          redraw
        />
      </div>
      {dims.map((d, i) => {
        const unavailable =
          Boolean(d.scoreUnavailable) ||
          d.score == null ||
          !Number.isFinite(Number(d.score)) ||
          Number(d.score) === 0
        const sc = unavailable ? null : Math.min(100, Math.max(0, Number(d.score)))
        const open = openIdx === i
        const isLowest = !unavailable && i === lowestIdx && sc < 100
        const hasReason = Boolean(String(d.reason || '').trim())
        return (
          <div
            key={i}
            className={`ma-dim-row${unavailable ? ' ma-dim-row--unavailable' : ''}${isLowest ? ' ma-dim-row--lowest' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => handleRowClick(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleRowClick(i)
              }
            }}
          >
            <div className="ma-dim-head">
              <span className="ma-dim-name">{d.name}</span>
              <div className="ma-dim-bar-track">
                {!unavailable ? (
                  <div
                    className="ma-dim-bar-fill"
                    style={{
                      width: barsAnim ? `${sc}%` : '0%',
                      background: d.color,
                      transition: `width 400ms ease-out ${i * 60}ms`,
                    }}
                  />
                ) : (
                  <div className="ma-dim-bar-fill ma-dim-bar-fill--na" aria-hidden />
                )}
              </div>
              {unavailable ? (
                <span
                  className="ma-dim-score ma-dim-score--na"
                  title={t('report.dimScoreUnavailableTip')}
                >
                  {t('report.dimScoreUnavailable')}
                </span>
              ) : (
                <span className="ma-dim-score ma-num">{sc}</span>
              )}
            </div>
            {hasReason ? (
              <div className={`ma-dim-reason-wrap${open ? ' ma-dim-reason-wrap--open' : ''}`}>
                <p className="ma-dim-reason">{d.reason}</p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
