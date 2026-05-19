const fs = require('fs');
const path = require('path');

const content = `import { useEffect, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { adminFetch } from '../adminApi.js'
import { Card, PageTitle, fmtDate } from '../components.jsx'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function SystemPage() {
  const [h, setH] = useState(null)
  const [costs, setCosts] = useState(null)
  const [openLog, setOpenLog] = useState(null)
  const [openPred, setOpenPred] = useState(null)

  useEffect(() => {
    Promise.all([adminFetch('/admin/system/api-health'), adminFetch('/admin/system/costs')]).then(
      ([health, cost]) => {
        setH(health)
        setCosts(cost)
      },
    )
  }, [])

  if (!h) return <p className="text-slate-500">\u52a0\u8f7d\u4e2d\u2026</p>

  const monthCost = Number(costs?.monthCost || h.monthCost || 0)
  const byModel = costs?.byModel || h.byModel || []
  const totalModelCost = byModel.reduce((s, m) => s + Number(m.cost || 0), 0) || 1

  const line = {
    labels: (costs?.dailyCost || []).map((d) => d.d),
    datasets: [
      {
        label: '\u6bcf\u65e5\u8d39\u7528 USD',
        data: (costs?.dailyCost || []).map((d) => d.cost),
        borderColor: '#10b981',
        tension: 0.2,
      },
    ],
  }

  return (
    <>
      <PageTitle>\u7cfb\u7edf\u76d1\u63a7</PageTitle>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card
          title="OpenRouter"
          value={\`\${h.openRouter?.successRate ?? 0}% \u6210\u529f\`}
          sub={\`\u5747\u8017\u65f6 \${h.openRouter?.avgMs ?? 0}ms | \u6700\u540e \${fmtDate(h.openRouter?.lastAt)}\`}
        />
        <Card
          title="Alpha Vantage"
          value={\`\u4eca\u65e5 \${h.alphaVantage?.callsToday ?? 0} \u6b21\`}
          sub={\`\u914d\u989d\u4f59 \${Math.max(0, (h.alphaVantage?.quotaPerDay ?? 500) - (h.alphaVantage?.callsToday ?? 0))} | \${fmtDate(h.alphaVantage?.lastAt)}\`}
        />
        <Card
          title="\u6570\u636e\u5e93"
          value={h.database?.ok ? '\u6b63\u5e38' : '\u5f02\u5e38'}
          sub={\`\u6700\u6162\u67e5\u8be2 \${h.database?.slowMs ?? 0}ms\`}
        />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 p-4">
          <h2 className="text-sm text-slate-400">\u672c\u6708 OpenRouter \u8d39\u7528</h2>
          <p className="mt-2 text-2xl text-white">\${monthCost.toFixed(4)}</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-400">
            {byModel.map((m) => {
              const c = Number(m.cost) || 0
              const pct = Math.round((c / totalModelCost) * 100)
              return (
                <li key={m.model}>
                  {m.model}: \${c.toFixed(4)} ({pct}%)
                </li>
              )
            })}
          </ul>
        </div>
        <motion.div className="rounded-xl border border-slate-700 p-4">
          <h2 className="mb-2 text-sm text-slate-400">\u8fc7\u53bb 30 \u5929\u6bcf\u65e5\u8d39\u7528</h2>
          <Line data={line} options={{ responsive: true }} />
        </motion.div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-400">\u5931\u8d25\u5206\u6790\uff08\u6700\u8fd1 20 \u6761\uff09</h2>
          <ul className="space-y-1 text-sm">
            {(h.failedLogs || []).map((r) => (
              <li key={r.id} className="rounded border border-slate-800">
                <button
                  type="button"
                  className="w-full px-2 py-1 text-left"
                  onClick={() => setOpenLog(openLog === r.id ? null : r.id)}
                >
                  {r.ticker} | {fmtDate(r.created_at)} | {r.status}
                </button>
                {openLog === r.id ? (
                  <p className="border-t border-slate-800 px-2 py-1 text-xs text-red-300">{r.error_message || '-'}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-400">\u5931\u8d25\u9884\u6d4b\u9a8c\u8bc1\uff08\u6700\u8fd1 20 \u6761\uff09</h2>
          <ul className="space-y-1 text-sm">
            {(h.failedPreds || []).map((r) => (
              <li key={r.id} className="rounded border border-slate-800">
                <button
                  type="button"
                  className="w-full px-2 py-1 text-left text-slate-400"
                  onClick={() => setOpenPred(openPred === r.id ? null : r.id)}
                >
                  {r.ticker} | {r.status} | {r.skip_reason || fmtDate(r.created_at)}
                </button>
                {openPred === r.id && r.skip_reason ? (
                  <p className="border-t border-slate-800 px-2 py-1 text-xs text-amber-300">{r.skip_reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </motion.div>
    </>
  )
}
`;

const out = path.join(__dirname, '..', 'src/admin/pages/System.jsx');
const fixed = content.replace(/<\/?motion\.div/g, (m) => m.replace('motion.', ''));
fs.writeFileSync(out, fixed, 'utf8');
console.log('wrote', out);
