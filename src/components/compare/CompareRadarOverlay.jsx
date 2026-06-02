import { useMemo } from 'react'
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

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const COLORS = ['#6366f1', '#22c55e', '#f59e0b']

export default function CompareRadarOverlay({ reports }) {
  const items = (reports || []).filter((r) => r?.dimensions?.length).slice(0, 3)
  const labels = items[0]?.dimensions?.map((d) => d.name) || []

  const data = useMemo(() => {
    if (!labels.length) return null
    return {
      labels,
      datasets: items.map((r, i) => ({
        label: r.symbol || `T${i + 1}`,
        data: labels.map((name) => {
          const d = (r.dimensions || []).find((x) => x.name === name)
          return Number(d?.score) || 0
        }),
        backgroundColor: `${COLORS[i % COLORS.length]}33`,
        borderColor: COLORS[i % COLORS.length],
        borderWidth: 2,
        pointRadius: 2,
      })),
    }
  }, [items, labels])

  if (!data) return null

  return (
    <div style={{ maxWidth: 420, margin: '0 auto 24px', padding: '0 12px' }}>
      <Radar
        data={data}
        options={{
          responsive: true,
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: { display: false },
              grid: { color: 'rgba(255,255,255,0.1)' },
              pointLabels: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } },
            },
          },
          plugins: { legend: { labels: { color: 'rgba(255,255,255,0.8)' } } },
        }}
      />
    </div>
  )
}
