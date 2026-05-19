import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { adminFetch } from '../adminApi.js'

import { Card, PageTitle, TableWrap, Th, Td, fmtDate, tendencyLabel } from '../components.jsx'



export default function OverviewPage() {

  const { t } = useTranslation()

  const [data, setData] = useState(null)

  const [err, setErr] = useState('')



  useEffect(() => {

    adminFetch('/admin/stats/overview')

      .then(setData)

      .catch((e) => setErr(e.message))

  }, [])



  if (err) return <p className="text-red-400">{err}</p>

  if (!data) return <p className="text-slate-500">{t('admin.common.loading')}</p>



  const acc = data.accuracy || {}

  return (

    <>

      <PageTitle>{t('admin.overview.title')}</PageTitle>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <Card

          title={t('admin.overview.usersTotal')}

          value={data.usersTotal}

          sub={t('admin.overview.usersToday', { n: data.usersToday })}

        />

        <Card

          title={t('admin.overview.analysesTotal')}

          value={data.analysesTotal}

          sub={t('admin.overview.analysesToday', { n: data.analysesToday })}

        />

        <Card

          title={t('admin.overview.accuracy')}

          value={acc.verified ? `${acc.tendencyAccuracy}%` : '-'}

          sub={t('admin.overview.verifiedCount', { n: acc.verified || 0 })}

        />

        <Card

          title={t('admin.overview.monthCost')}

          value={`$${Number(data.monthCost || 0).toFixed(2)}`}

          sub={t('admin.overview.costFromLogs')}

        />

      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">

        <section>

          <h2 className="mb-3 text-sm font-medium text-slate-400">{t('admin.overview.recentLogs')}</h2>

          <TableWrap>

            <thead>

              <tr>

                <Th>ticker</Th>

                <Th>{t('admin.common.user')}</Th>

                <Th>{t('admin.common.time')}</Th>

                <Th>tier</Th>

                <Th>{t('admin.logs.model')}</Th>

              </tr>

            </thead>

            <tbody>

              {(data.recentLogs || []).map((r, i) => (

                <tr key={i}>

                  <Td>{r.ticker}</Td>

                  <Td className="max-w-[8rem] truncate">{r.email || r.external_key || '-'}</Td>

                  <Td>{fmtDate(r.created_at)}</Td>

                  <Td>{r.tier}</Td>

                  <Td className="max-w-[6rem] truncate text-xs">{r.model}</Td>

                </tr>

              ))}

            </tbody>

          </TableWrap>

        </section>

        <section>

          <h2 className="mb-3 text-sm font-medium text-slate-400">{t('admin.overview.recentResults')}</h2>

          <TableWrap>

            <thead>

              <tr>

                <Th>ticker</Th>

                <Th>{t('admin.overview.predDirection')}</Th>

                <Th>{t('admin.overview.actualChange')}</Th>

                <Th>{t('admin.overview.scenario')}</Th>

                <Th>{t('admin.common.result')}</Th>

              </tr>

            </thead>

            <tbody>

              {(data.recentResults || []).map((r, i) => (

                <tr key={i}>

                  <Td>{r.ticker}</Td>

                  <Td>{tendencyLabel(r.tendency)}</Td>

                  <Td>{r.price_change_pct != null ? `${r.price_change_pct}%` : '-'}</Td>

                  <Td>{r.scenario_hit || '-'}</Td>

                  <Td>{r.tendency_correct ? '✓' : '✗'}</Td>

                </tr>

              ))}

            </tbody>

          </TableWrap>

        </section>

      </div>

    </>

  )

}

