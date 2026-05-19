import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from 'react-i18next'

import {

  Chart as ChartJS,

  ArcElement,

  CategoryScale,

  LinearScale,

  PointElement,

  LineElement,

  Tooltip,

  Legend,

} from 'chart.js'

import { Doughnut, Line } from 'react-chartjs-2'

import { adminFetch } from '../adminApi.js'

import { Card, PageTitle } from '../components.jsx'



ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)



const TIER_LABEL = { free: 'Free', pro: 'Pro', pro_plus: 'Pro+', proplus: 'Pro+' }



export default function RevenuePage() {

  const { t } = useTranslation()

  const [data, setData] = useState(null)



  useEffect(() => {

    adminFetch('/admin/stats/revenue').then(setData)

  }, [])



  const line = useMemo(() => {

    if (!data) return null

    const labels = (data.dailyUsers || []).map((d) => d.d)

    const paidMap = new Map((data.dailyPaid || []).map((d) => [d.d, d.c]))

    return {

      labels,

      datasets: [

        {

          label: t('admin.revenue.dailyNew'),

          data: (data.dailyUsers || []).map((d) => d.c),

          borderColor: '#3b82f6',

          tension: 0.2,

        },

        {

          label: t('admin.revenue.dailyPaid'),

          data: labels.map((d) => paidMap.get(d) || 0),

          borderColor: '#10b981',

          tension: 0.2,

        },

      ],

    }

  }, [data, t])



  if (!data) return <p className="text-slate-500">{t('admin.common.loading')}</p>



  const paidTotal = data.paidTotal || 0

  const conv = data.totalUsers ? Math.round((paidTotal / data.totalUsers) * 1000) / 10 : 0



  const pie = {

    labels: data.tiers.map((tierRow) => TIER_LABEL[tierRow.tier] || tierRow.tier),

    datasets: [

      {

        data: data.tiers.map((tierRow) => tierRow.c),

        backgroundColor: ['#64748b', '#3b82f6', '#8b5cf6'],

      },

    ],

  }



  return (

    <>

      <PageTitle>{t('admin.revenue.title')}</PageTitle>

      <p className="mb-4 text-xs text-slate-500">{t('admin.revenue.note')}</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">

        <Card title={t('admin.revenue.mrrMonth')} value={`$${data.mrr}`} />

        <Card

          title={t('admin.revenue.paidUsers')}

          value={paidTotal}

          sub={t('admin.revenue.convSub', { n: conv })}

        />

        <Card title={t('admin.revenue.totalUsers')} value={data.totalUsers} />

      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">

          <h2 className="mb-3 text-sm text-slate-400">{t('admin.revenue.tierDist')}</h2>

          <Doughnut data={pie} />

        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">

          <h2 className="mb-3 text-sm text-slate-400">{t('admin.revenue.chart30d')}</h2>

          {line ? <Line data={line} options={{ responsive: true }} /> : null}

        </div>

      </div>

    </>

  )

}

