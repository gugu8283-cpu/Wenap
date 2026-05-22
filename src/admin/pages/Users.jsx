import { Fragment, useEffect, useState } from 'react'
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

export default function UsersPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [tierNote, setTierNote] = useState('')
  const [filters, setFilters] = useState({ tier: 'all', banned: '', q: '' })
  const [banReason, setBanReason] = useState('')

  function load() {
    const q = new URLSearchParams()
    if (filters.tier !== 'all') q.set('tier', filters.tier)
    if (filters.banned) q.set('banned', filters.banned)
    if (filters.q) q.set('q', filters.q)
    adminFetch(`/admin/users?${q}`).then((d) => setRows(d.rows || []))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openUser(id) {
    setOpenId(openId === id ? null : id)
    if (openId !== id) {
      const d = await adminFetch(`/admin/users/${id}`)
      setDetail(d)
      setTierNote('')
    }
  }

  async function setTier(id, tier) {
    if (!window.confirm(t('admin.users.confirmTier', { tier }))) return
    const d = await adminFetch(`/admin/users/${id}/tier`, {
      method: 'PUT',
      body: JSON.stringify({ tier, note: tierNote || 'admin' }),
    })
    setDetail(d)
    load()
    if (openId === id) {
      const fresh = await adminFetch(`/admin/users/${id}`)
      setDetail(fresh)
    }
  }

  async function resetTrials(id) {
    if (!window.confirm(t('admin.users.confirmReset'))) return
    await adminFetch(`/admin/users/${id}/reset-trials`, { method: 'PUT', body: '{}' })
    load()
    if (openId === id) openUser(id)
  }

  async function toggleBan(id, banned) {
    if (banned && !banReason.trim()) {
      window.alert(t('admin.users.needBanReason'))
      return
    }
    if (!window.confirm(banned ? t('admin.users.confirmBan') : t('admin.users.confirmUnban'))) return
    await adminFetch(`/admin/users/${id}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ banned, reason: banReason }),
    })
    load()
    if (openId === id) openUser(id)
  }

  const u = detail?.user
  const usage = detail?.usage
  const billing = detail?.billing

  return (
    <>
      <PageTitle>{t('admin.users.title')}</PageTitle>
      <p className="mb-4 text-xs text-slate-500">{t('admin.users.subtitle')}</p>
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
        <Field label={t('admin.users.banned')}>
          <select
            className={inputCls}
            value={filters.banned}
            onChange={(e) => setFilters((f) => ({ ...f, banned: e.target.value }))}
          >
            <option value="">{t('admin.common.all')}</option>
            <option value="1">{t('admin.users.filterBanned')}</option>
            <option value="0">{t('admin.users.filterNormal')}</option>
          </select>
        </Field>
        <Field label={t('admin.users.search')}>
          <input
            className={inputCls}
            placeholder={t('admin.users.searchPlaceholder')}
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </Field>
        <Btn onClick={load}>{t('admin.common.filter')}</Btn>
      </FilterBar>
      <TableWrap>
        <thead>
          <tr>
            <Th>{t('admin.users.colEmail')}</Th>
            <Th>tier</Th>
            <Th>{t('admin.users.colRegistered')}</Th>
            <Th>{t('admin.users.colLastActive')}</Th>
            <Th>{t('admin.users.colAnalysisCount')}</Th>
            <Th>{t('admin.users.colFreeLeft')}</Th>
            <Th>{t('admin.users.colStatus')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <tr className="cursor-pointer hover:bg-slate-800/50" onClick={() => openUser(row.id)}>
                <Td>{row.email || row.external_key || row.id.slice(0, 8)}</Td>
                <Td>{row.tier}</Td>
                <Td>{fmtDate(row.created_at)}</Td>
                <Td>{fmtDate(row.last_active_at)}</Td>
                <Td>{row.analysis_count}</Td>
                <Td>{Math.max(0, (row.free_trials_limit || 5) - (row.free_trials_used || 0))}</Td>
                <Td>{row.is_banned ? t('admin.users.statusBanned') : t('admin.users.statusNormal')}</Td>
              </tr>
              {openId === row.id && u?.id === row.id ? (
                <tr>
                  <td colSpan={7} className="border-b border-slate-800 bg-slate-900/80 p-4">
                    <div className="grid gap-4 text-sm md:grid-cols-2">
                      <div>
                        <h3 className="font-medium text-slate-300">{t('admin.users.profile')}</h3>
                        <dl className="mt-2 space-y-1 text-slate-400">
                          <div>
                            <dt className="inline text-slate-500">ID: </dt>
                            <dd className="inline font-mono text-xs">{u.id}</dd>
                          </div>
                          <div>
                            <dt className="inline text-slate-500">{t('admin.users.colEmail')}: </dt>
                            <dd className="inline">{u.email || '—'}</dd>
                          </div>
                          <div>
                            <dt className="inline text-slate-500">{t('admin.users.phone')}: </dt>
                            <dd className="inline">{u.phone || '—'}</dd>
                          </div>
                          <div>
                            <dt className="inline text-slate-500">{t('admin.users.country')}: </dt>
                            <dd className="inline">{u.country_code || '—'}</dd>
                          </div>
                          <div>
                            <dt className="inline text-slate-500">{t('admin.users.emailVerified')}: </dt>
                            <dd className="inline">{u.email_verified ? '✓' : '—'}</dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-300">{t('admin.users.usageStats')}</h3>
                        <dl className="mt-2 space-y-1 text-slate-400">
                          <div>
                            {t('admin.users.colAnalysisCount')}: <strong className="text-slate-200">{usage?.analyses ?? 0}</strong>
                          </div>
                          <div>
                            {t('admin.users.totalTokens')}:{' '}
                            <strong className="text-slate-200">
                              {((usage?.inputTokens || 0) + (usage?.outputTokens || 0)).toLocaleString()}
                            </strong>{' '}
                            ({t('admin.users.tokensInOut', { inp: usage?.inputTokens || 0, out: usage?.outputTokens || 0 })})
                          </div>
                          <div>
                            {t('admin.users.totalCost')}: <strong className="text-slate-200">${(usage?.totalCostUsd || 0).toFixed(4)}</strong>
                          </div>
                        </dl>
                      </div>
                      {billing ? (
                        <div className="md:col-span-2">
                          <h3 className="font-medium text-slate-300">{t('admin.users.billing')}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Stripe: {billing.stripe_customer_id || '—'} · {billing.status} · {billing.subscription_renews_at ? fmtDate(billing.subscription_renews_at) : '—'}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 md:col-span-2">{t('admin.users.noBilling')}</p>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-amber-600/90">{t('admin.users.tierHint')}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <select
                        className={inputCls}
                        defaultValue={u.tier === 'proplus' ? 'pro_plus' : u.tier}
                        onChange={(e) => setTier(row.id, e.target.value)}
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="pro_plus">pro_plus</option>
                      </select>
                      <input
                        className={inputCls}
                        placeholder={t('admin.users.tierNote')}
                        value={tierNote}
                        onChange={(e) => setTierNote(e.target.value)}
                      />
                      <Btn onClick={() => resetTrials(row.id)}>{t('admin.users.resetTrials')}</Btn>
                      <input
                        className={inputCls}
                        placeholder={t('admin.users.banReason')}
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                      />
                      <Btn variant="danger" onClick={() => toggleBan(row.id, !u.is_banned)}>
                        {u.is_banned ? t('admin.users.unban') : t('admin.users.ban')}
                      </Btn>
                    </div>

                    {(detail.tierHistory || []).length ? (
                      <div className="mt-4 text-xs text-slate-500">
                        <p className="text-slate-400">{t('admin.users.tierHistory')}</p>
                        <ul className="mt-1">
                          {detail.tierHistory.map((h, i) => (
                            <li key={i}>
                              {fmtDate(h.created_at)}: {h.old_tier || '—'} → {h.new_tier}
                              {h.note ? ` (${h.note})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <h3 className="mt-4 text-sm font-medium text-slate-400">{t('admin.users.recentLogs')}</h3>
                    <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-slate-400">
                      {(detail.logs || []).map((l) => (
                        <li key={l.id} className="border-b border-slate-800/50 py-1">
                          {l.ticker} · {l.tier} · {l.model} · {fmtDate(l.created_at)} ·{' '}
                          {(l.input_tokens || 0) + (l.output_tokens || 0)} tok · ${Number(l.cost_usd || 0).toFixed(4)}
                        </li>
                      ))}
                    </ul>
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
