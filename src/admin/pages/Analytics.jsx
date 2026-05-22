import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { adminFetch } from '../adminApi.js'
import { Btn, Card, Field, PageTitle, inputCls } from '../components.jsx'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

const PERIODS = ['day', 'week', 'month', 'quarter', 'year']

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    const q = new URLSearchParams({ period })
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    setErr('')
    adminFetch(`/admin/stats/analytics?${q}`)
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [period, from, to])

  useEffect(() => {
    load()
  }, [load])

  const costChart = useMemo(() => {
    if (!data?.series?.analyses?.length) return null
    const labels = data.series.analyses.map((r) => r.bucket)
    return {
      labels,
      datasets: [
        {
          label: t('admin.analytics.chartCost'),
          data: data.series.analyses.map((r) => r.costUsd),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.2)',
          tension: 0.2,
        },
        {
          label: t('admin.analytics.chartAnalyses'),
          data: data.series.analyses.map((r) => r.success),
          borderColor: '#3b82f6',
          yAxisID: 'y1',
          tension: 0.2,
        },
      ],
    }
  }, [data, t])

  const revenueChart = useMemo(() => {
    if (!data?.series?.revenueCash?.length) return null
    return {
      labels: data.series.revenueCash.map((r) => r.bucket),
      datasets: [
        {
          label: t('admin.analytics.chartRevenueCash'),
          data: data.series.revenueCash.map((r) => r.amountUsd),
          backgroundColor: 'rgba(16,185,129,0.6)',
        },
      ],
    }
  }, [data, t])

  const tokenChart = useMemo(() => {
    if (!data?.series?.analyses?.length) return null
    return {
      labels: data.series.analyses.map((r) => r.bucket),
      datasets: [
        {
          label: t('admin.analytics.chartTokensIn'),
          data: data.series.analyses.map((r) => r.inputTokens),
          borderColor: '#8b5cf6',
          tension: 0.2,
        },
        {
          label: t('admin.analytics.chartTokensOut'),
          data: data.series.analyses.map((r) => r.outputTokens),
          borderColor: '#ec4899',
          tension: 0.2,
        },
      ],
    }
  }, [data, t])

  const s = data?.summary

  return (
    <>
      <PageTitle>{t('admin.analytics.title')}</PageTitle>
      <p className="mb-4 text-xs text-slate-500">{t('admin.analytics.subtitle')}</p>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                period === p ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {t(`admin.analytics.period.${p}`)}
            </button>
          ))}
        </div>
        <Field label={t('admin.analytics.from')}>
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t('admin.analytics.to')}>
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Btn onClick={load}>{t('admin.common.filter')}</Btn>
      </div>

      {data ? (
        <p className="mb-4 text-xs text-slate-500">
          {t('admin.analytics.range', { from: data.from, to: data.to, period: t(`admin.analytics.period.${data.period}`) })}
        </p>
      ) : null}

      {err ? <p className="text-red-400">{err}</p> : null}
      {!data && !err ? <p className="text-slate-500">{t('admin.common.loading')}</p> : null}

      {s ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card
              title={t('admin.analytics.analyses')}
              value={s.analysesSuccess}
              sub={t('admin.analytics.analysesSub', { total: s.analysesTotal, failed: s.analysesFailed })}
            />
            <Card
              title={t('admin.analytics.tokens')}
              value={(s.inputTokens + s.outputTokens).toLocaleString()}
              sub={t('admin.analytics.tokensSub', { inp: s.inputTokens.toLocaleString(), out: s.outputTokens.toLocaleString() })}
            />
            <Card title={t('admin.analytics.cost')} value={`$${s.costUsd.toFixed(2)}`} sub={t('admin.analytics.costSub')} />
            <Card
              title={t('admin.analytics.revenueCash')}
              value={`$${s.revenueCashUsd.toFixed(2)}`}
              sub={t('admin.analytics.revenueCashSub', { n: s.revenueCashCount, month: s.monthRevenueCashUsd })}
            />
          </div>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Card title={t('admin.analytics.mrrEstimate')} value={`$${s.revenueMrrEstimate}`} sub={t('admin.analytics.mrrSub', { pro: s.paidPro, proPlus: s.paidProPlus })} />
            <Card title={t('admin.analytics.newUsers')} value={s.newUsers} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm text-slate-400">{t('admin.analytics.chartCostTitle')}</h2>
              {costChart ? (
                <Line
                  data={costChart}
                  options={{
                    responsive: true,
                    scales: { y1: { position: 'right', grid: { drawOnChartArea: false } } },
                  }}
                />
              ) : (
                <p className="text-sm text-slate-500">{t('admin.analytics.noData')}</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <h2 className="mb-3 text-sm text-slate-400">{t('admin.analytics.chartTokensTitle')}</h2>
              {tokenChart ? <Line data={tokenChart} options={{ responsive: true }} /> : <p className="text-sm text-slate-500">{t('admin.analytics.noData')}</p>}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 lg:col-span-2">
              <h2 className="mb-3 text-sm text-slate-400">{t('admin.analytics.chartRevenueTitle')}</h2>
              {revenueChart ? (
                <Bar data={revenueChart} options={{ responsive: true }} />
              ) : (
                <p className="text-sm text-slate-500">{t('admin.analytics.noRevenueYet')}</p>
              )}
            </div>
          </div>

          <details className="mt-8 text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-400">{t('admin.analytics.dataSources')}</summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>{data.dataSources?.analyses}</li>
              <li>{data.dataSources?.revenueCash}</li>
              <li>{data.dataSources?.revenueMrr}</li>
            </ul>
          </details>
        </>
      ) : null}
    </>
  )
}
