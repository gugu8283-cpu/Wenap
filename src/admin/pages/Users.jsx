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

    }

  }



  async function setTier(id, tier) {

    if (!window.confirm(t('admin.users.confirmTier', { tier }))) return

    await adminFetch(`/admin/users/${id}/tier`, { method: 'PUT', body: JSON.stringify({ tier }) })

    load()

    if (openId === id) openUser(id)

  }



  async function resetTrials(id) {

    if (!window.confirm(t('admin.users.confirmReset'))) return

    await adminFetch(`/admin/users/${id}/reset-trials`, { method: 'PUT', body: '{}' })

    load()

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

  }



  return (

    <>

      <PageTitle>{t('admin.users.title')}</PageTitle>

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

          {rows.map((u) => (

            <Fragment key={u.id}>

              <tr className="cursor-pointer hover:bg-slate-800/50" onClick={() => openUser(u.id)}>

                <Td>{u.email || u.external_key || u.id.slice(0, 8)}</Td>

                <Td>{u.tier}</Td>

                <Td>{fmtDate(u.created_at)}</Td>

                <Td>{fmtDate(u.last_active_at)}</Td>

                <Td>{u.analysis_count}</Td>

                <Td>{Math.max(0, (u.free_trials_limit || 5) - (u.free_trials_used || 0))}</Td>

                <Td>{u.is_banned ? t('admin.users.statusBanned') : t('admin.users.statusNormal')}</Td>

              </tr>

              {openId === u.id && detail?.user?.id === u.id ? (

                <tr>

                  <td colSpan={7} className="border-b border-slate-800 bg-slate-900/80 p-4">

                    <div className="mt-3 flex flex-wrap gap-3">

                      <select

                        className={inputCls}

                        defaultValue={detail.user.tier}

                        onChange={(e) => setTier(u.id, e.target.value)}

                      >

                        <option value="free">free</option>

                        <option value="pro">pro</option>

                        <option value="pro_plus">pro_plus</option>

                      </select>

                      <Btn onClick={() => resetTrials(u.id)}>{t('admin.users.resetTrials')}</Btn>

                      <input

                        className={inputCls}

                        placeholder={t('admin.users.banReason')}

                        value={banReason}

                        onChange={(e) => setBanReason(e.target.value)}

                      />

                      <Btn variant="danger" onClick={() => toggleBan(u.id, !detail.user.is_banned)}>

                        {detail.user.is_banned ? t('admin.users.unban') : t('admin.users.ban')}

                      </Btn>

                    </div>

                    <ul className="mt-3 text-sm text-slate-400">

                      {(detail.logs || []).map((l) => (

                        <li key={l.id}>

                          {l.ticker} | {l.tier} | {l.model} | {fmtDate(l.created_at)}

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

