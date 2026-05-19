import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'

import { Line } from 'react-chartjs-2'

import { adminFetch } from '../adminApi.js'

import { Card, PageTitle, fmtDate } from '../components.jsx'



ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)



export default function SystemPage() {

  const { t } = useTranslation()

  const [h, setH] = useState(null)

  const [costs, setCosts] = useState(null)

  const [openLog, setOpenLog] = useState(null)

  const [openPred, setOpenPred] = useState(null)



  useEffect(() => {

    Promise.all([adminFetch('/admin/system/api-health'), adminFetch('/admin/system/costs')]).then(

      ([health, cost]) => {

        setH(health)

        setCosts(cost)

      },

    )

  }, [])



  if (!h) return <p className="text-slate-500">{t('admin.common.loading')}</p>



  const monthCost = Number(costs?.monthCost || h.monthCost || 0)

  const byModel = costs?.byModel || h.byModel || []

  const totalModelCost = byModel.reduce((s, m) => s + Number(m.cost || 0), 0) || 1



  const line = {

    labels: (costs?.dailyCost || []).map((d) => d.d),

    datasets: [

      {

        label: t('admin.system.dailyCost'),

        data: (costs?.dailyCost || []).map((d) => d.cost),

        borderColor: '#10b981',

        tension: 0.2,

      },

    ],

  }



  const avQuota = h.alphaVantage?.quotaPerDay ?? 500

  const avToday = h.alphaVantage?.callsToday ?? 0



  return (

    <>

      <PageTitle>{t('admin.system.title')}</PageTitle>

      <div className="mb-6 grid gap-4 md:grid-cols-3">

        <Card

          title={t('admin.system.openRouter')}

          value={t('admin.system.orSuccess', { n: h.openRouter?.successRate ?? 0 })}

          sub={t('admin.system.orSub', {

            ms: h.openRouter?.avgMs ?? 0,

            at: fmtDate(h.openRouter?.lastAt),

          })}

        />

        <Card

          title={t('admin.system.alpha')}

          value={t('admin.system.avToday', { n: avToday })}

          sub={t('admin.system.avSub', {

            left: Math.max(0, avQuota - avToday),

            at: fmtDate(h.alphaVantage?.lastAt),

          })}

        />

        <Card

          title={t('admin.system.database')}

          value={h.database?.ok ? t('admin.system.dbOk') : t('admin.system.dbBad')}

          sub={t('admin.system.dbSub', { ms: h.database?.slowMs ?? 0 })}

        />

      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">

        <div className="rounded-xl border border-slate-700 p-4">

          <h2 className="text-sm text-slate-400">{t('admin.system.monthCost')}</h2>

          <p className="mt-2 text-2xl text-white">${monthCost.toFixed(4)}</p>

          <ul className="mt-3 space-y-1 text-sm text-slate-400">

            {byModel.map((m) => {

              const c = Number(m.cost) || 0

              const pct = Math.round((c / totalModelCost) * 100)

              return (

                <li key={m.model}>

                  {m.model}: ${c.toFixed(4)} ({pct}%)

                </li>

              )

            })}

          </ul>

        </div>

        <div className="rounded-xl border border-slate-700 p-4">

          <h2 className="mb-2 text-sm text-slate-400">{t('admin.system.dailyCost')}</h2>

          <Line data={line} options={{ responsive: true }} />

        </div>

      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <section>

          <h2 className="mb-2 text-sm font-medium text-slate-400">{t('admin.system.failedLogs')}</h2>

          <ul className="space-y-1 text-sm">

            {(h.failedLogs || []).map((r) => (

              <li key={r.id} className="rounded border border-slate-800">

                <button

                  type="button"

                  className="w-full px-2 py-1 text-left"

                  onClick={() => setOpenLog(openLog === r.id ? null : r.id)}

                >

                  {r.ticker} | {fmtDate(r.created_at)} | {r.status}

                </button>

                {openLog === r.id ? (

                  <p className="border-t border-slate-800 px-2 py-1 text-xs text-red-300">{r.error_message || '-'}</p>

                ) : null}

              </li>

            ))}

          </ul>

        </section>

        <section>

          <h2 className="mb-2 text-sm font-medium text-slate-400">{t('admin.system.failedVerify')}</h2>

          <ul className="space-y-1 text-sm">

            {(h.failedPreds || []).map((r) => (

              <li key={r.id} className="rounded border border-slate-800">

                <button

                  type="button"

                  className="w-full px-2 py-1 text-left text-slate-400"

                  onClick={() => setOpenPred(openPred === r.id ? null : r.id)}

                >

                  {r.ticker} | {r.status} | {r.skip_reason || fmtDate(r.created_at)}

                </button>

                {openPred === r.id && r.skip_reason ? (

                  <p className="border-t border-slate-800 px-2 py-1 text-xs text-amber-300">{r.skip_reason}</p>

                ) : null}

              </li>

            ))}

          </ul>

        </section>

      </div>

    </>

  )

}

