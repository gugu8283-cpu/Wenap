const fs = require('fs');
const path = require('path');

const content = `import { Fragment, useEffect, useState } from 'react'
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
    adminFetch(\`/admin/users?\${q}\`).then((d) => setRows(d.rows || []))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openUser(id) {
    setOpenId(openId === id ? null : id)
    if (openId !== id) {
      const d = await adminFetch(\`/admin/users/\${id}\`)
      setDetail(d)
    }
  }

  async function setTier(id, tier) {
    if (!window.confirm('确认修改 tier 为 ' + tier + '？')) return
    await adminFetch(\`/admin/users/\${id}/tier\`, { method: 'PUT', body: JSON.stringify({ tier }) })
    load()
    if (openId === id) openUser(id)
  }

  async function resetTrials(id) {
    if (!window.confirm('确认重置免费次数为 5？')) return
    await adminFetch(\`/admin/users/\${id}/reset-trials\`, { method: 'PUT', body: '{}' })
    load()
  }

  async function toggleBan(id, banned) {
    if (banned && !banReason.trim()) {
      window.alert('请填写封禁原因')
      return
    }
    if (!window.confirm(banned ? '确认封禁？' : '确认解封？')) return
    await adminFetch(\`/admin/users/\${id}/ban\`, {
      method: 'PUT',
      body: JSON.stringify({ banned, reason: banReason }),
    })
    load()
  }

  return (
    <>
      <PageTitle>\u7528\u6237\u7ba1\u7406</PageTitle>
      <FilterBar>
        <Field label="tier">
          <select
            className={inputCls}
            value={filters.tier}
            onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value }))}
          >
            <option value="all">\u5168\u90e8</option>
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="pro_plus">pro_plus</option>
          </select>
        </Field>
        <Field label="\u5c01\u7981">
          <select
            className={inputCls}
            value={filters.banned}
            onChange={(e) => setFilters((f) => ({ ...f, banned: e.target.value }))}
          >
            <option value="">\u5168\u90e8</option>
            <option value="1">\u5df2\u5c01\u7981</option>
            <option value="0">\u6b63\u5e38</option>
          </select>
        </Field>
        <Field label="\u641c\u7d22">
          <input
            className={inputCls}
            placeholder="email / phone"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </Field>
        <Btn onClick={load}>\u7b5b\u9009</Btn>
      </FilterBar>
      <TableWrap>
        <thead>
          <tr>
            <Th>\u90ae\u7bb1</Th>
            <Th>tier</Th>
            <Th>\u6ce8\u518c\u65f6\u95f4</Th>
            <Th>\u6700\u540e\u6d3b\u8dc3</Th>
            <Th>\u5206\u6790\u6b21\u6570</Th>
            <Th>\u514d\u8d39\u5269\u4f59</Th>
            <Th>\u72b6\u6001</Th>
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
                <Td>{u.is_banned ? '\u5c01\u7981' : '\u6b63\u5e38'}</Td>
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
                      <Btn onClick={() => resetTrials(u.id)}>\u91cd\u7f6e\u514d\u8d39\u6b21\u6570</Btn>
                      <input
                        className={inputCls}
                        placeholder="\u5c01\u7981\u539f\u56e0"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                      />
                      <Btn variant="danger" onClick={() => toggleBan(u.id, !detail.user.is_banned)}>
                        {detail.user.is_banned ? '\u89e3\u5c01' : '\u5c01\u7981'}
                      </Btn>
                    </motion.div>
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
`;

const out = path.join(__dirname, '..', 'src/admin/pages/Users.jsx');
const fixed = content.replace(/<\/?motion\.div/g, (m) => m.replace('motion.', ''));
fs.writeFileSync(out, fixed, 'utf8');
console.log('wrote', out);
