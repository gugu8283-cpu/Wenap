const fs = require('fs');
const path = require('path');

const overview = `import { useEffect, useState } from 'react'
import { adminFetch } from '../adminApi.js'
import { Card, PageTitle, TableWrap, Th, Td, fmtDate, tendencyLabel } from '../components.jsx'

export default function OverviewPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    adminFetch('/admin/stats/overview')
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [])

  if (err) return <p className="text-red-400">{err}</p>
  if (!data) return <p className="text-slate-500">\u52a0\u8f7d\u4e2d\u2026</p>

  const acc = data.accuracy || {}
  return (
    <>
      <PageTitle>\u603b\u89c8</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="\u603b\u7528\u6237\u6570" value={data.usersTotal} sub={\`\u4eca\u65e5 +\${data.usersToday}\`} />
        <Card title="\u603b\u5206\u6790\u6b21\u6570" value={data.analysesTotal} sub={\`\u4eca\u65e5 \${data.analysesToday}\`} />
        <Card
          title="\u65b9\u5411\u51c6\u786e\u7387"
          value={acc.verified ? \`\${acc.tendencyAccuracy}%\` : '-'}
          sub={\`\u5df2\u9a8c\u8bc1 \${acc.verified || 0} \u6761\`}
        />
        <Card
          title="\u672c\u6708\u4f30\u7b97\u6210\u672c"
          value={\`$\${Number(data.monthCost || 0).toFixed(2)}\`}
          sub="\u6765\u81ea analysis_logs"
        />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-400">\u6700\u8fd1 10 \u6761\u5206\u6790</h2>
          <TableWrap>
            <thead>
              <tr>
                <Th>ticker</Th>
                <Th>\u7528\u6237</Th>
                <Th>\u65f6\u95f4</Th>
                <Th>tier</Th>
                <Th>\u6a21\u578b</Th>
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
          <h2 className="mb-3 text-sm font-medium text-slate-400">\u6700\u8fd1 10 \u6761\u9a8c\u8bc1\u7ed3\u679c</h2>
          <TableWrap>
            <thead>
              <tr>
                <Th>ticker</Th>
                <Th>\u9884\u6d4b\u65b9\u5411</Th>
                <Th>\u5b9e\u9645\u6da8\u8dcc</Th>
                <Th>\u60c5\u666f</Th>
                <Th>\u7ed3\u679c</Th>
              </tr>
            </thead>
            <tbody>
              {(data.recentResults || []).map((r, i) => (
                <tr key={i}>
                  <Td>{r.ticker}</Td>
                  <Td>{tendencyLabel(r.tendency)}</Td>
                  <Td>{r.price_change_pct != null ? \`\${r.price_change_pct}%\` : '-'}</Td>
                  <Td>{r.scenario_hit || '-'}</Td>
                  <Td>{r.tendency_correct ? '\u2713' : '\u2717'}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </section>
      </div>
    </>
  )
}
`;

const revenue = `import { useEffect, useMemo, useState } from 'react'
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
          label: '\u6bcf\u65e5\u65b0\u589e\u7528\u6237',
          data: (data.dailyUsers || []).map((d) => d.c),
          borderColor: '#3b82f6',
          tension: 0.2,
        },
        {
          label: '\u6bcf\u65e5\u65b0\u589e\u4ed8\u8d39',
          data: labels.map((d) => paidMap.get(d) || 0),
          borderColor: '#10b981',
          tension: 0.2,
        },
      ],
    }
  }, [data])

  if (!data) return <p className="text-slate-500">\u52a0\u8f7d\u4e2d\u2026</p>

  const paidTotal = data.paidTotal || 0
  const conv = data.totalUsers ? Math.round((paidTotal / data.totalUsers) * 1000) / 10 : 0

  const pie = {
    labels: data.tiers.map((t) => TIER_LABEL[t.tier] || t.tier),
    datasets: [
      {
        data: data.tiers.map((t) => t.c),
        backgroundColor: ['#64748b', '#3b82f6', '#8b5cf6'],
      },
    ],
  }

  return (
    <>
      <PageTitle>\u6536\u5165\u6982\u89c8</PageTitle>
      <p className="mb-4 text-xs text-slate-500">\u6536\u5165\u4e3a\u4f30\u7b97\u503c\uff0c\u4ee5 Stripe \u5b9e\u9645\u6570\u636e\u4e3a\u51c6</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card title="\u672c\u6708 MRR\uff08\u4f30\u7b97\uff09" value={\`$\${data.mrr}\`} />
        <Card title="\u4ed8\u8d39\u7528\u6237" value={paidTotal} sub={\`\u8f6c\u5316\u7387 \${conv}%\`} />
        <Card title="\u603b\u7528\u6237" value={data.totalUsers} />
      </div>
      <motion.div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-sm text-slate-400">\u7528\u6237 tier \u5206\u5e03</h2>
          <Doughnut data={pie} />
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-sm text-slate-400">\u8fd1 30 \u5929\uff1a\u65b0\u589e\u7528\u6237 vs \u65b0\u589e\u4ed8\u8d39</h2>
          {line ? <Line data={line} options={{ responsive: true }} /> : null}
        </div>
      </motion.div>
    </>
  )
}
`;

const root = path.join(__dirname, '..', 'src/admin/pages');
const fix = (s) => s.replace(/<\/?motion\.div/g, (m) => m.replace('motion.', ''));
fs.writeFileSync(path.join(root, 'Overview.jsx'), fix(overview), 'utf8');
fs.writeFileSync(path.join(root, 'Revenue.jsx'), fix(revenue), 'utf8');
console.log('wrote Overview.jsx and Revenue.jsx');
