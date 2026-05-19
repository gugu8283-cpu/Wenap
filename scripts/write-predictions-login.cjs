const fs = require('fs');
const path = require('path');

const predictions = `import { useCallback, useEffect, useState } from 'react'
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

const SKIP_PRESETS = ['\u9000\u5e02', '\u88ab\u6536\u8d2d', '\u6570\u636e\u7f3a\u5931', '\u5176\u4ed6']

export default function PredictionsPage() {
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

  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (filters.status !== 'all') q.set('status', filters.status)
    if (filters.ticker) q.set('ticker', filters.ticker)
    if (filters.from) q.set('from', filters.from)
    if (filters.to) q.set('to', filters.to)
    if (filters.backtest) q.set('backtest', '1')
    Promise.all([adminFetch('/admin/predictions/accuracy'), adminFetch(\`/admin/predictions?\${q}\`)])
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
      setMsg('\u5df2\u89e6\u53d1\u9a8c\u8bc1')
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
      setMsg(\`\u5df2\u6279\u91cf\u9a8c\u8bc1 \${selected.size} \u6761\`)
      setSelected(new Set())
      load()
    } catch (e) {
      setMsg(e.message)
    }
  }

  async function skipRow(id) {
    const preset = window.prompt(
      \`\u8df3\u8fc7\u539f\u56e0\uff08\${SKIP_PRESETS.join(' / ')}\uff09\uff1a\`,
      '\u6570\u636e\u7f3a\u5931',
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
            \u6279\u91cf\u9a8c\u8bc1 ({selected.size})
          </Btn>
        }
      >
        \u9884\u6d4b\u8ffd\u8e2a
      </PageTitle>
      {stats ? (
        <>
          <motion.div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              ['\u65b9\u5411\u51c6\u786e\u7387', \`\${stats.tendencyAccuracy}%\`, \`\u5206\u6bcd \${verified}\`],
              ['\u60c5\u666f\u51c6\u786e\u7387', \`\${stats.scenarioAccuracy}%\`, \`\u5206\u6bcd \${verified}\`],
              ['\u76ee\u6807\u4ef7\u8fbe\u6210\u7387', \`\${stats.targetHitRate}%\`, \`\u5206\u6bcd \${verified}\`],
            ].map(([k, v, sub]) => (
              <div key={k} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3">
                <p className="text-xs text-slate-500">{k}</p>
                <p className="text-2xl font-semibold text-white">{v}</p>
                <p className="text-xs text-slate-600">{sub}</p>
              </div>
            ))}
          </motion.div>
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
        <Field label="\u72b6\u6001">
          <select
            className={inputCls}
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="all">\u5168\u90e8</option>
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
        <Field label="\u8d77">
          <input
            type="date"
            className={inputCls}
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </Field>
        <Field label="\u6b62">
          <input
            type="date"
            className={inputCls}
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </Field>
        <Field label="\u56de\u6d4b">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={filters.backtest}
              onChange={(e) => setFilters((f) => ({ ...f, backtest: e.target.checked }))}
            />
            \u4ec5\u56de\u6d4b
          </label>
        </Field>
        <Btn onClick={load}>\u7b5b\u9009</Btn>
      </FilterBar>
      {msg ? <p className="mb-2 text-sm text-amber-400">{msg}</p> : null}
      <p className="mb-2 text-xs text-slate-500">\u5171 {total} \u6761</p>
      <TableWrap>
        <thead>
          <tr>
            <Th />
            <Th>ticker</Th>
            <Th>\u5206\u6790\u65e5\u671f</Th>
            <Th>\u9884\u6d4b\u65b9\u5411</Th>
            <Th>\u8bc4\u5206</Th>
            <Th>\u73b0\u4ef7</Th>
            <Th>\u5b9e\u9645\u4ef7</Th>
            <Th>\u6da8\u8dcc%</Th>
            <Th>\u60c5\u666f\u547d\u4e2d</Th>
            <Th>\u7ed3\u679c</Th>
            <Th>\u72b6\u6001</Th>
            <Th>\u64cd\u4f5c</Th>
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
                  <span className="ml-1 rounded bg-slate-600 px-1 text-xs text-slate-300">\u56de\u6d4b</span>
                ) : null}
              </Td>
              <Td>{r.analyzed_at?.slice(0, 10) || fmtDate(r.analyzed_at)}</Td>
              <Td>{tendencyLabel(r.tendency)}</Td>
              <Td>{r.score}</Td>
              <Td>{r.current_price}</Td>
              <Td>{r.actual_price ?? '-'}</Td>
              <Td>{fmtPct(r.price_change_pct)}</Td>
              <Td>{r.scenario_hit || '-'}</Td>
              <Td>{r.tendency_correct != null ? (r.tendency_correct ? '\u2713' : '\u2717') : '-'}</Td>
              <Td>{r.status}</Td>
              <Td className="space-x-1 whitespace-nowrap">
                {r.status === 'pending' ? (
                  <Btn variant="ghost" onClick={() => verifyOne(r.id)}>
                    \u9a8c\u8bc1
                  </Btn>
                ) : null}
                {r.status === 'pending' || r.status === 'failed' ? (
                  <Btn variant="ghost" onClick={() => skipRow(r.id)}>
                    \u8df3\u8fc7
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
`;

const login = `import { useState } from 'react'
import { adminFetch, setAdminToken } from './adminApi.js'

export default function AdminLogin({ onSuccess }) {
  const [secret, setSecret] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    setAdminToken(secret)
    try {
      await adminFetch('/admin/stats/overview')
      onSuccess()
    } catch (ex) {
      setErr(ex.message === 'UNAUTHORIZED' ? '\u5bc6\u94a5\u9519\u8bef' : ex.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl"
      >
        <h1 className="text-xl font-semibold text-white">Wenap Admin</h1>
        <p className="mt-2 text-sm text-slate-400">\u8bf7\u8f93\u5165 .env \u4e2d\u914d\u7f6e\u7684 ADMIN_SECRET\uff08\u81f3\u5c11 32 \u4f4d\uff09</p>
        <input
          type="password"
          className="mt-6 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          autoComplete="off"
        />
        {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
        <button
          type="submit"
          disabled={loading || !secret.trim()}
          className="mt-6 w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? '\u9a8c\u8bc1\u4e2d\u2026' : '\u8fdb\u5165\u7ba1\u7406\u540e\u53f0'}
        </button>
      </form>
    </motion.div>
  )
}
`;

const fix = (s) => s.replace(/<\/?motion\.motion\.div/g, (m) => m.replace('motion.', '')).replace(/<\/?motion\.motion\.motion\.motion\.div/g, (m) => m.replace('motion.', ''));
const root = path.join(__dirname, '..', 'src/admin');
fs.writeFileSync(path.join(root, 'pages/Predictions.jsx'), fix(predictions), 'utf8');
fs.writeFileSync(path.join(root, 'AdminLogin.jsx'), fix(login).replace('</motion.div>', '</div>').replace('<motion.div', '<div'), 'utf8');
console.log('wrote Predictions.jsx and AdminLogin.jsx');
