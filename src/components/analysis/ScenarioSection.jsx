import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'
import { useInView } from '../../hooks/useInView.js'

const W = 320

function scenClass(type) {
  if (type === 'bull') return 'ma-scen-p--bull'
  if (type === 'bear') return 'ma-scen-p--bear'
  return 'ma-scen-p--base'
}

function fillFor(type) {
  if (type === 'bull') return 'rgba(29,158,117,0.30)'
  if (type === 'bear') return 'rgba(226,75,74,0.25)'
  return 'rgba(55,138,221,0.22)'
}

function priceInAnyInterval(price, intervals) {
  return intervals.some((iv) => price >= iv.min && price <= iv.max)
}

export default function ScenarioSection({ scenarios, currentPrice }) {
  const { t } = useTranslation()
  const { ref: sectionRef, inView } = useInView({ threshold: 0.15 })
  const [chartAnim, setChartAnim] = useState(false)

  useEffect(() => {
    if (inView) {
      const t = setTimeout(() => setChartAnim(true), 60)
      return () => clearTimeout(t)
    }
    setChartAnim(false)
    return undefined
  }, [inView])

  const rows = scenarios || []
  const numericRows = rows.filter((s) => Number.isFinite(s.rangeMin) && Number.isFinite(s.rangeMax))

  const axis = useMemo(() => {
    if (!numericRows.length) return null

    const bearRow = numericRows.find((r) => r.type === 'bear')
    const bullRow = numericRows.find((r) => r.type === 'bull')
    const bearMin = bearRow ? bearRow.rangeMin : Math.min(...numericRows.map((r) => r.rangeMin))
    const bullMax = bullRow ? bullRow.rangeMax : Math.max(...numericRows.map((r) => r.rangeMax))
    const axisRange = Math.max(bullMax - bearMin, 1)
    const axisMin = bearMin - axisRange * 0.1
    const axisMax = bullMax + axisRange * 0.1
    const scale = (x) => ((x - axisMin) / (axisMax - axisMin)) * W

    const intervals = numericRows.map((s) => ({
      min: s.rangeMin,
      max: s.rangeMax,
      type: s.type,
    }))

    const segs = numericRows.map((s) => {
      const x1 = scale(s.rangeMin)
      const x2 = scale(s.rangeMax)
      return { type: s.type, x1, w: Math.max(2, x2 - x1) }
    })

    const priceOutside =
      Number.isFinite(currentPrice) &&
      currentPrice > 0 &&
      !priceInAnyInterval(currentPrice, intervals)

    return {
      bearMin,
      bullMax,
      axisMin,
      axisMax,
      scale,
      segs,
      priceOutside,
    }
  }, [numericRows, currentPrice])

  const scenLabel = (type) => {
    if (type === 'bull') return t('report.scenarioBull')
    if (type === 'bear') return t('report.scenarioBear')
    return t('report.scenarioBase')
  }

  return (
    <div ref={sectionRef} className="ma-card ma-scenario-card">
      <h2 className="ma-section-title">{t('report.scenario')}</h2>
      {rows.map((s) => (
        <div key={s.type} className="ma-scenario-row">
          <div className={`ma-scen-p ${scenClass(s.type)}`}>{s.probability}%</div>
          <div>
            <div className="ma-scen-mid">
              {scenLabel(s.type)} ·{' '}
              {Number.isFinite(s.rangeMin) && Number.isFinite(s.rangeMax)
                ? `$${s.rangeMin.toFixed(0)} – $${s.rangeMax.toFixed(0)}`
                : s.rangeLabel || '—'}
            </div>
            <div className="ma-scen-trig">{s.trigger}</div>
            {s.triggerPrice || s.timeWindow ? (
              <div className="ma-scen-detail">
                {Number.isFinite(s.triggerPrice)
                  ? t('report.triggerAt', { price: s.triggerPrice.toFixed(2) })
                  : null}
                {s.triggerPrice && s.timeWindow ? ' · ' : null}
                {s.timeWindow ? t('report.window', { window: s.timeWindow }) : null}
              </div>
            ) : null}
          </div>
        </div>
      ))}
      {axis?.priceOutside ? (
        <p className="ma-scen-outside-hint">{t('report.scenarioOutside')}</p>
      ) : null}
      {axis ? (
        <svg className="ma-axis-svg" viewBox={`0 0 ${W} 56`} preserveAspectRatio="none" aria-hidden>
          <rect
            x={0}
            y={14}
            width={chartAnim ? W : 0}
            height={20}
            fill="rgba(255,255,255,0.04)"
            rx={4}
            style={{ transition: 'width 500ms ease-out' }}
          />
          {axis.segs.map((seg, si) => (
            <rect
              key={seg.type}
              x={seg.x1}
              y={14}
              width={chartAnim ? seg.w : 0}
              height={20}
              fill={fillFor(seg.type)}
              rx={3}
              style={{ transition: `width 500ms ease-out ${si * 80}ms` }}
            />
          ))}
          {Number.isFinite(currentPrice) && currentPrice > 0 ? (
            <g>
              <line
                x1={axis.scale(currentPrice)}
                y1={8}
                x2={axis.scale(currentPrice)}
                y2={44}
                stroke="#378ADD"
                strokeWidth={2}
              />
              <text
                x={axis.scale(currentPrice)}
                y={6}
                textAnchor="middle"
                fontSize={12}
                fill={axis.priceOutside ? 'rgba(255,255,255,0.4)' : '#FFFFFF'}
                className="ma-num"
              >
                {axis.priceOutside
                  ? `$${currentPrice.toFixed(0)} · ${t('report.watchRange')}`
                  : `$${currentPrice.toFixed(0)}`}
              </text>
            </g>
          ) : null}
          <text x={0} y={52} fontSize="10" fill="var(--text-secondary)" className="ma-num">
            ${axis.bearMin.toFixed(0)}
          </text>
          <text x={W} y={52} textAnchor="end" fontSize="10" fill="var(--text-secondary)" className="ma-num">
            ${axis.bullMax.toFixed(0)}
          </text>
        </svg>
      ) : null}
    </div>
  )
}
