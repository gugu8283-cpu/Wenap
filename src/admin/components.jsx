export function Card({ title, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <p className="text-xs text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  )
}

export function PageTitle({ children, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-white">{children}</h1>
      {right}
    </div>
  )
}

export function TableWrap({ children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="min-w-full text-left text-sm text-slate-300">{children}</table>
    </div>
  )
}

export function Th({ children }) {
  return (
    <th className="border-b border-slate-700 bg-slate-900/90 px-3 py-2 font-medium text-slate-400">
      {children}
    </th>
  )
}

export function Td({ children, className = '' }) {
  return <td className={`border-b border-slate-800 px-3 py-2 ${className}`}>{children}</td>
}

export function Btn({ children, onClick, variant = 'primary', disabled }) {
  const cls =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500'
      : variant === 'ghost'
        ? 'border border-slate-600 hover:bg-slate-800'
        : 'bg-blue-600 hover:bg-blue-500'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  )
}

export function FilterBar({ children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
      {children}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      {children}
    </label>
  )
}

export const inputCls =
  'rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-200'

import i18n, { resolveAppLanguage } from '../i18n/index.js'

export function tendencyLabel(t) {
  const key = String(t || '').toLowerCase()
  if (key === 'buy' || key === 'hold' || key === 'sell') {
    return i18n.t(`admin.tendency.${key}`)
  }
  return t
}

export function fmtDate(iso) {
  if (!iso) return '-'
  try {
    const lng = resolveAppLanguage(i18n.resolvedLanguage || i18n.language)
    return new Date(iso).toLocaleString(lng, { hour12: false })
  } catch {
    return iso
  }
}

export function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return '-'
  const v = Number(n)
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}
