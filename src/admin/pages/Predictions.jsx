import { useCallback, useEffect, useState } from 'react'

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

  fmtPct,

  inputCls,

  tendencyLabel,

} from '../components.jsx'



export default function PredictionsPage() {

  const { t } = useTranslation()

  const [stats, setStats] = useState(null)

  const [rows, setRows] = useState([])

  const [total, setTotal] = useState(0)

  const [selected, setSelected] = useState(() => new Set())

  const [filters, setFilters] = useState({

    status: 'all',

    ticker: '',

    from: '',

    to: '',

    backtest: false,

  })

  const [msg, setMsg] = useState('')



  const skipPresets = t('admin.predictions.skipOptions').split('|')



  const load = useCallback(() => {

    const q = new URLSearchParams()

    if (filters.status !== 'all') q.set('status', filters.status)

    if (filters.ticker) q.set('ticker', filters.ticker)

    if (filters.from) q.set('from', filters.from)

    if (filters.to) q.set('to', filters.to)

    if (filters.backtest) q.set('backtest', '1')

    Promise.all([adminFetch('/admin/predictions/accuracy'), adminFetch(`/admin/predictions?${q}`)])

      .then(([acc, list]) => {

        setStats(acc)

        setRows(list.rows || [])

        setTotal(list.total || 0)

      })

      .catch((e) => setMsg(e.message))

  }, [filters])



  useEffect(() => {

    load()

  }, [load])



  function toggle(id) {

    setSelected((prev) => {

      const next = new Set(prev)

      if (next.has(id)) next.delete(id)

      else next.add(id)

      return next

    })

  }



  async function verifyOne(id) {

    setMsg('')

    try {

      await adminFetch('/admin/predictions/verify', {

        method: 'POST',

        body: JSON.stringify({ id }),

      })

      setMsg(t('admin.predictions.verifyTriggered'))

      load()

    } catch (e) {

      setMsg(e.message)

    }

  }



  async function verifyBatch() {

    if (!selected.size) return

    setMsg('')

    try {

      await adminFetch('/admin/predictions/verify', {

        method: 'POST',

        body: JSON.stringify({ ids: [...selected] }),

      })

      setMsg(t('admin.predictions.verifyBatchDone', { n: selected.size }))

      setSelected(new Set())

      load()

    } catch (e) {

      setMsg(e.message)

    }

  }



  async function skipRow(id) {

    const preset = window.prompt(

      t('admin.predictions.skipPrompt', { options: skipPresets.join(' / ') }),

      t('admin.predictions.skipDefault'),

    )

    if (!preset) return

    await adminFetch('/admin/predictions/skip', {

      method: 'POST',

      body: JSON.stringify({ id, reason: preset }),

    })

    load()

  }



  const verified = stats?.verified || 0



  return (

    <>

      <PageTitle

        right={

          <Btn onClick={verifyBatch} disabled={!selected.size}>

            {t('admin.predictions.batchVerify', { n: selected.size })}

          </Btn>

        }

      >

        {t('admin.predictions.title')}

      </PageTitle>

      {stats ? (

        <>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">

            {[

              ['tendencyAcc', stats.tendencyAccuracy],

              ['scenarioAcc', stats.scenarioAccuracy],

              ['targetHit', stats.targetHitRate],

            ].map(([key, val]) => (

              <div key={key} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3">

                <p className="text-xs text-slate-500">{t(`admin.predictions.${key}`)}</p>

                <p className="text-2xl font-semibold text-white">{val}%</p>

                <p className="text-xs text-slate-600">{t('admin.common.denominator', { n: verified })}</p>

              </div>

            ))}

          </div>

          <div className="mb-4 flex flex-wrap gap-2">

            {[

              ['pending', stats.pending],

              ['verified', stats.verified],

              ['failed', stats.failed],

              ['skipped', stats.skipped || 0],

            ].map(([k, v]) => (

              <span key={k} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">

                {k}: {v}

              </span>

            ))}

          </div>

        </>

      ) : null}

      <FilterBar>

        <Field label={t('admin.predictions.filterStatus')}>

          <select

            className={inputCls}

            value={filters.status}

            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}

          >

            <option value="all">{t('admin.common.all')}</option>

            <option value="pending">pending</option>

            <option value="verified">verified</option>

            <option value="failed">failed</option>

            <option value="skipped">skipped</option>

          </select>

        </Field>

        <Field label="ticker">

          <input

            className={inputCls}

            value={filters.ticker}

            onChange={(e) => setFilters((f) => ({ ...f, ticker: e.target.value }))}

          />

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

        <Field label={t('admin.predictions.backtest')}>

          <label className="flex items-center gap-2 text-sm text-slate-300">

            <input

              type="checkbox"

              checked={filters.backtest}

              onChange={(e) => setFilters((f) => ({ ...f, backtest: e.target.checked }))}

            />

            {t('admin.predictions.backtestOnly')}

          </label>

        </Field>

        <Btn onClick={load}>{t('admin.common.filter')}</Btn>

      </FilterBar>

      {msg ? <p className="mb-2 text-sm text-amber-400">{msg}</p> : null}

      <p className="mb-2 text-xs text-slate-500">{t('admin.common.totalRows', { n: total })}</p>

      <TableWrap>

        <thead>

          <tr>

            <Th />

            <Th>ticker</Th>

            <Th>{t('admin.predictions.analyzedAt')}</Th>

            <Th>{t('admin.overview.predDirection')}</Th>

            <Th>{t('admin.predictions.score')}</Th>

            <Th>{t('admin.predictions.currentPrice')}</Th>

            <Th>{t('admin.predictions.actualPrice')}</Th>

            <Th>{t('admin.predictions.changePct')}</Th>

            <Th>{t('admin.predictions.scenarioHit')}</Th>

            <Th>{t('admin.common.result')}</Th>

            <Th>{t('admin.common.status')}</Th>

            <Th>{t('admin.common.actions')}</Th>

          </tr>

        </thead>

        <tbody>

          {rows.map((r) => (

            <tr key={r.id}>

              <Td>

                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />

              </Td>

              <Td>

                {r.ticker}

                {r.is_backtest ? (

                  <span className="ml-1 rounded bg-slate-600 px-1 text-xs text-slate-300">

                    {t('admin.predictions.backtestTag')}

                  </span>

                ) : null}

              </Td>

              <Td>{r.analyzed_at?.slice(0, 10) || fmtDate(r.analyzed_at)}</Td>

              <Td>{tendencyLabel(r.tendency)}</Td>

              <Td>{r.score}</Td>

              <Td>{r.current_price}</Td>

              <Td>{r.actual_price ?? '-'}</Td>

              <Td>{fmtPct(r.price_change_pct)}</Td>

              <Td>{r.scenario_hit || '-'}</Td>

              <Td>{r.tendency_correct != null ? (r.tendency_correct ? '✓' : '✗') : '-'}</Td>

              <Td>{r.status}</Td>

              <Td className="space-x-1 whitespace-nowrap">

                {r.status === 'pending' ? (

                  <Btn variant="ghost" onClick={() => verifyOne(r.id)}>

                    {t('admin.predictions.verify')}

                  </Btn>

                ) : null}

                {r.status === 'pending' || r.status === 'failed' ? (

                  <Btn variant="ghost" onClick={() => skipRow(r.id)}>

                    {t('admin.predictions.skip')}

                  </Btn>

                ) : null}

              </Td>

            </tr>

          ))}

        </tbody>

      </TableWrap>

    </>

  )

}

