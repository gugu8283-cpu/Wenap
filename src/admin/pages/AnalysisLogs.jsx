import { Fragment, useCallback, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { adminFetch } from '../adminApi.js'

import {

  Btn,

  Field,

  FilterBar,

  PageTitle,

  TableWrap,

  Th,

  Td,

  fmtDate,

  inputCls,

} from '../components.jsx'



export default function AnalysisLogsPage() {

  const { t } = useTranslation()

  const [data, setData] = useState({ rows: [], agg: {}, total: 0 })

  const [openId, setOpenId] = useState(null)

  const [filters, setFilters] = useState({

    tier: 'all',

    ticker: '',

    model: '',

    status: 'all',

    from: '',

    to: '',

  })



  const load = useCallback(() => {

    const q = new URLSearchParams()

    if (filters.tier !== 'all') q.set('tier', filters.tier)

    if (filters.ticker) q.set('ticker', filters.ticker)

    if (filters.model) q.set('model', filters.model)

    if (filters.status !== 'all') q.set('status', filters.status)

    if (filters.from) q.set('from', filters.from)

    if (filters.to) q.set('to', filters.to)

    adminFetch(`/admin/analysis-logs?${q}`).then(setData)

  }, [filters])



  useEffect(() => {

    load()

     

  }, [load])



  const agg = data.agg || {}

  const cnt = agg.cnt || 1

  const okRate = cnt ? Math.round(((agg.ok || 0) / cnt) * 100) : 0



  return (

    <>

      <PageTitle>{t('admin.logs.title')}</PageTitle>

      <FilterBar>

        <Field label="tier">

          <select

            className={inputCls}

            value={filters.tier}

            onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value }))}

          >

            <option value="all">{t('admin.common.all')}</option>

            <option value="free">free</option>

            <option value="pro">pro</option>

            <option value="pro_plus">pro_plus</option>

          </select>

        </Field>

        <Field label="ticker">

          <input className={inputCls} value={filters.ticker} onChange={(e) => setFilters((f) => ({ ...f, ticker: e.target.value }))} />

        </Field>

        <Field label={t('admin.logs.model')}>

          <input className={inputCls} value={filters.model} onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))} />

        </Field>

        <Field label={t('admin.common.status')}>

          <select className={inputCls} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>

            <option value="all">{t('admin.common.all')}</option>

            <option value="success">success</option>

            <option value="failed">failed</option>

          </select>

        </Field>

        <Field label={t('admin.predictions.dateFrom')}>

          <input

            type="date"

            className={inputCls}

            value={filters.from}

            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}

          />

        </Field>

        <Field label={t('admin.predictions.dateTo')}>

          <input

            type="date"

            className={inputCls}

            value={filters.to}

            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}

          />

        </Field>

        <Btn onClick={load}>{t('admin.common.filter')}</Btn>

      </FilterBar>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

        <div className="rounded-lg border border-slate-700 p-3">

          <p className="text-xs text-slate-500">{t('admin.logs.totalTokens')}</p>

          <p className="text-lg text-white">

            {((agg.inputTokens || 0) + (agg.outputTokens || 0)).toLocaleString()}

          </p>

        </div>

        <div className="rounded-lg border border-slate-700 p-3">

          <p className="text-xs text-slate-500">{t('admin.logs.totalCost')}</p>

          <p className="text-lg text-white">${Number(agg.totalCost || 0).toFixed(4)}</p>

        </div>

        <div className="rounded-lg border border-slate-700 p-3">

          <p className="text-xs text-slate-500">{t('admin.logs.avgCost')}</p>

          <p className="text-lg text-white">${(Number(agg.totalCost || 0) / cnt).toFixed(4)}</p>

        </div>

        <div className="rounded-lg border border-slate-700 p-3">

          <p className="text-xs text-slate-500">{t('admin.logs.successRate')}</p>

          <p className="text-lg text-white">{okRate}%</p>

        </div>

        <div className="rounded-lg border border-slate-700 p-3">

          <p className="text-xs text-slate-500">{t('admin.logs.avgDuration')}</p>

          <p className="text-lg text-white">{Math.round(agg.avgMs || 0)}ms</p>

        </div>

      </div>

      <TableWrap>

        <thead>

          <tr>

            <Th>{t('admin.common.time')}</Th>

            <Th>{t('admin.common.user')}</Th>

            <Th>ticker</Th>

            <Th>tier</Th>

            <Th>{t('admin.logs.model')}</Th>

            <Th>{t('admin.logs.tokens')}</Th>

            <Th>{t('admin.logs.totalCost')}</Th>

            <Th>{t('admin.logs.duration')}</Th>

            <Th>{t('admin.common.status')}</Th>

          </tr>

        </thead>

        <tbody>

          {(data.rows || []).map((r) => (

            <Fragment key={r.id}>

              <tr

                className={r.status === 'failed' ? 'bg-red-950/30' : ''}

                onClick={() => r.status === 'failed' && setOpenId(openId === r.id ? null : r.id)}

              >

                <Td>{fmtDate(r.created_at)}</Td>

                <Td className="max-w-[6rem] truncate">{r.email || r.external_key || '-'}</Td>

                <Td>{r.ticker}</Td>

                <Td>{r.tier}</Td>

                <Td className="max-w-[10rem] truncate text-xs">{r.model}</Td>

                <Td>{(r.input_tokens || 0) + (r.output_tokens || 0)}</Td>

                <Td>${Number(r.cost_usd || 0).toFixed(4)}</Td>

                <Td>{r.duration_ms ? `${r.duration_ms}ms` : '-'}</Td>

                <Td>{r.status}</Td>

              </tr>

              {openId === r.id && r.error_message ? (

                <tr key={`${r.id}-err`}>

                  <td colSpan={9} className="bg-red-950/20 px-3 py-2 text-xs text-red-300">

                    {r.error_message}

                  </td>

                </tr>

              ) : null}

            </Fragment>

          ))}

        </tbody>

      </TableWrap>

    </>

  )

}

