import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminFetch, getAdminPin, getAdminToken } from '../adminApi.js'
import { Card, PageTitle } from '../components.jsx'
import FinancePdfSheet from '../FinancePdfSheet.jsx'
import { exportBookkeepingPdf } from '../exportBookkeepingPdf.js'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function toAdminApiPath(path) {
  const p = String(path || '').trim()
  if (p.startsWith('/admin-api')) return p
  if (p.startsWith('/admin/')) return `/admin-api/${p.slice(7)}`
  return p.startsWith('/') ? `/admin-api${p}` : `/admin-api/${p}`
}

export default function FinancePage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [subs, setSubs] = useState(null)
  const [expenses, setExpenses] = useState(null)
  const [form, setForm] = useState({ amountUsd: '', category: 'infra', note: '', expenseDate: '' })
  const [saving, setSaving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [err, setErr] = useState('')
  const pdfRef = useRef(null)

  const reload = useCallback(async () => {
    const [s, sub, exp] = await Promise.all([
      adminFetch('/admin/bookkeeping/stats'),
      adminFetch('/admin/bookkeeping/subscribers'),
      adminFetch('/admin/bookkeeping/expenses'),
    ])
    setStats(s)
    setSubs(sub)
    setExpenses(exp)
  }, [])

  useEffect(() => {
    reload().catch((e) => setErr(e.message || 'load failed'))
  }, [reload])

  async function downloadPdf() {
    if (!pdfRef.current) throw new Error('PDF not ready')
    setPdfBusy(true)
    setErr('')
    try {
      const date = new Date().toISOString().slice(0, 10)
      await exportBookkeepingPdf(pdfRef.current, `wenap-bookkeeping-${date}.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }

  async function downloadCsv() {
    const token = getAdminToken()
    const pin = getAdminPin()
    const res = await fetch(`${API_BASE}${toAdminApiPath('/admin/bookkeeping/export.csv')}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(pin ? { 'X-Admin-Pin': pin } : {}),
      },
    })
    if (!res.ok) throw new Error('export failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wenap-bookkeeping.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function addExpense(e) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await adminFetch('/admin/bookkeeping/expenses', {
        method: 'POST',
        body: JSON.stringify({
          amountUsd: Number(form.amountUsd),
          category: form.category,
          note: form.note,
          expenseDate: form.expenseDate || undefined,
        }),
      })
      setForm({ amountUsd: '', category: form.category, note: '', expenseDate: '' })
      await reload()
    } catch (ex) {
      setErr(ex.message || 'save failed')
    } finally {
      setSaving(false)
    }
  }

  async function removeExpense(id) {
    if (!window.confirm(t('admin.finance.confirmDelete'))) return
    await adminFetch(`/admin/bookkeeping/expenses/${id}`, { method: 'DELETE' })
    await reload()
  }

  if (!stats) {
    return <p className="text-slate-500">{t('admin.common.loading')}</p>
  }

  const checklist = t('admin.finance.checklist', { returnObjects: true })

  return (
    <>
      <PageTitle>{t('admin.finance.title')}</PageTitle>
      <p className="mb-4 text-xs text-slate-500">{t('admin.finance.subtitle')}</p>

      {err ? <p className="mb-3 text-sm text-red-400">{err}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title={t('admin.finance.mrrEst')} value={`$${stats.paid.mrr}`} />
        <Card
          title={t('admin.finance.paidJapan')}
          value={stats.paid.japan}
          sub={t('admin.finance.paidTotalSub', { n: stats.paid.total })}
        />
        <Card title={t('admin.finance.paidForeign')} value={stats.paid.foreign} />
        <Card title={t('admin.finance.paidUnknown')} value={stats.paid.unknown} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card title={t('admin.finance.regJapan')} value={stats.register.japan} sub={`${t('admin.finance.regTotal')} ${stats.register.total}`} />
        <Card title={t('admin.finance.regForeign')} value={stats.register.foreign} />
        <Card title={t('admin.finance.regUnknown')} value={stats.register.unknown} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            stats.stripeConfigured ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
          }`}
        >
          {stats.stripeConfigured ? t('admin.finance.stripeOk') : t('admin.finance.stripeMissing')}
        </span>
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          {t('admin.finance.stripeDash')}
        </a>
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => downloadPdf().catch((e) => setErr(e.message))}
          className="rounded-lg border border-blue-600/60 bg-blue-600/20 px-3 py-1.5 text-xs text-blue-200 hover:bg-blue-600/30 disabled:opacity-50"
        >
          {pdfBusy ? t('admin.finance.exportPdfBusy') : t('admin.finance.exportPdf')}
        </button>
        <button
          type="button"
          onClick={() => downloadCsv().catch((e) => setErr(e.message))}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          {t('admin.finance.exportCsv')}
        </button>
      </div>

      <FinancePdfSheet ref={pdfRef} stats={stats} subs={subs} expenses={expenses} t={t} />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-300">{t('admin.finance.subscribersTitle')}</h2>
          <p className="mb-3 text-xs text-slate-500">{t('admin.finance.countryNote')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2 pr-2">{t('admin.users.colEmail')}</th>
                  <th className="pb-2 pr-2">tier</th>
                  <th className="pb-2 pr-2">{t('admin.finance.colRegister')}</th>
                  <th className="pb-2 pr-2">{t('admin.finance.colBilling')}</th>
                  <th className="pb-2">{t('admin.finance.colRegion')}</th>
                </tr>
              </thead>
              <tbody>
                {(subs?.rows || []).map((r) => (
                  <tr key={r.id} className="border-t border-slate-800 text-slate-300">
                    <td className="py-2 pr-2 max-w-[140px] truncate">{r.email || r.id.slice(0, 8)}</td>
                    <td className="py-2 pr-2">{r.tier}</td>
                    <td className="py-2 pr-2">{r.register_country || '—'}</td>
                    <td className="py-2 pr-2">{r.customer_country || '—'}</td>
                    <td className="py-2">
                      {r.region === 'japan'
                        ? t('admin.finance.regionJapan')
                        : r.region === 'foreign'
                          ? t('admin.finance.regionForeign')
                          : t('admin.finance.regionUnknown')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">{t('admin.finance.expensesTitle')}</h2>
            <p className="mb-2 text-xs text-slate-500">
              {t('admin.finance.expensesMonth', {
                usd: stats.expenses.monthUsd,
                n: stats.expenses.monthCount,
              })}
            </p>
            <form onSubmit={addExpense} className="mb-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="USD"
                  value={form.amountUsd}
                  onChange={(e) => setForm((f) => ({ ...f, amountUsd: e.target.value }))}
                  className="w-24 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
                />
                <input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                  className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
                />
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
                >
                  <option value="infra">infra</option>
                  <option value="api">api</option>
                  <option value="tax">tax</option>
                  <option value="legal">legal</option>
                  <option value="other">other</option>
                </select>
              </div>
              <input
                type="text"
                placeholder={t('admin.finance.expenseNote')}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? t('admin.common.loading') : t('admin.finance.addExpense')}
              </button>
            </form>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-slate-400">
              {(expenses?.rows || []).map((e) => (
                <li key={e.id} className="flex justify-between gap-2 border-t border-slate-800 py-1">
                  <span>
                    {e.expense_date} · ${e.amount_usd} · {e.category || '—'} {e.note ? `· ${e.note}` : ''}
                  </span>
                  <button type="button" onClick={() => removeExpense(e.id)} className="text-red-400 hover:underline">
                    {t('admin.finance.delete')}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">{t('admin.finance.docsTitle')}</h2>
            <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
              {Array.isArray(checklist)
                ? checklist.map((item, i) => <li key={i}>{item}</li>)
                : null}
            </ul>
            <p className="mt-3 text-xs text-slate-500">{t('admin.finance.docsRepo')}</p>
          </div>
        </div>
      </div>
    </>
  )
}
