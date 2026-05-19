import { useMemo, useState } from 'react'

function num(v, fallback = 0) {
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

/** 仅运营粗算：默认单价为占位，务必用 OpenRouter / 云厂商账单回填 */
export default function EconomicsPanel() {
  const [freeMonthlyCap, setFreeMonthlyCap] = useState(5)
  const [freeActiveUsers, setFreeActiveUsers] = useState(200)
  const [avgFreeUsesPerUser, setAvgFreeUsesPerUser] = useState(3)
  const [proSubs, setProSubs] = useState(30)
  const [proPlusSubs, setProPlusSubs] = useState(5)
  const [avgProUses, setAvgProUses] = useState(15)
  const [avgProPlusUses, setAvgProPlusUses] = useState(20)

  const [mainIn, setMainIn] = useState(14000)
  const [mainOut, setMainOut] = useState(9000)
  const [leaderIn, setLeaderIn] = useState(3500)
  const [leaderOut, setLeaderOut] = useState(900)
  const [stockShare, setStockShare] = useState(0.75)

  const [flashInPerM, setFlashInPerM] = useState(0.1)
  const [flashOutPerM, setFlashOutPerM] = useState(0.4)
  const [sonnetInPerM, setSonnetInPerM] = useState(3)
  const [sonnetOutPerM, setSonnetOutPerM] = useState(15)
  const [haikuInPerM, setHaikuInPerM] = useState(0.25)
  const [haikuOutPerM, setHaikuOutPerM] = useState(1.25)

  const [avCallsPerAnalysis, setAvCallsPerAnalysis] = useState(1.5)
  const [avUsdPerAnalysis, setAvUsdPerAnalysis] = useState(0)

  const [fixedMonthlyUsd, setFixedMonthlyUsd] = useState(25)

  const out = useMemo(() => {
    const cap = Math.max(0, num(freeMonthlyCap, 5))
    const usesFree = Math.min(cap, Math.max(0, num(avgFreeUsesPerUser, 0)))
    const flashMain =
      (num(mainIn, 0) / 1e6) * num(flashInPerM, 0) + (num(mainOut, 0) / 1e6) * num(flashOutPerM, 0)
    const sonnetMain =
      (num(mainIn, 0) / 1e6) * num(sonnetInPerM, 0) + (num(mainOut, 0) / 1e6) * num(sonnetOutPerM, 0)
    const leaderCall =
      (num(leaderIn, 0) / 1e6) * num(haikuInPerM, 0) + (num(leaderOut, 0) / 1e6) * num(haikuOutPerM, 0)
    const share = Math.min(1, Math.max(0, num(stockShare, 0)))
    const av = Math.max(0, num(avCallsPerAnalysis, 0)) * Math.max(0, num(avUsdPerAnalysis, 0))

    const marginalFreeOrPro = flashMain + leaderCall * share + av
    const marginalProPlus = sonnetMain + leaderCall * share + av

    const freeAnalyses = Math.max(0, num(freeActiveUsers, 0)) * usesFree
    const proAnalyses = Math.max(0, num(proSubs, 0)) * Math.max(0, num(avgProUses, 0))
    const ppAnalyses = Math.max(0, num(proPlusSubs, 0)) * Math.max(0, num(avgProPlusUses, 0))

    const varUsd = freeAnalyses * marginalFreeOrPro + proAnalyses * marginalFreeOrPro + ppAnalyses * marginalProPlus
    const fixed = Math.max(0, num(fixedMonthlyUsd, 0))
    const totalCost = varUsd + fixed

    const rev = num(proSubs, 0) * 9.99 + num(proPlusSubs, 0) * 19.99
    const margin = rev - totalCost

    return {
      cap,
      usesFree,
      marginalFreeOrPro,
      marginalProPlus,
      freeAnalyses,
      proAnalyses,
      ppAnalyses,
      varUsd,
      fixed,
      totalCost,
      rev,
      margin,
    }
  }, [
    freeMonthlyCap,
    freeActiveUsers,
    avgFreeUsesPerUser,
    proSubs,
    proPlusSubs,
    avgProUses,
    avgProPlusUses,
    mainIn,
    mainOut,
    leaderIn,
    leaderOut,
    stockShare,
    flashInPerM,
    flashOutPerM,
    sonnetInPerM,
    sonnetOutPerM,
    haikuInPerM,
    haikuOutPerM,
    avCallsPerAnalysis,
    avUsdPerAnalysis,
    fixedMonthlyUsd,
  ])

  const fmt = (x) =>
    Number.isFinite(x)
      ? x.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
      : '—'

  return (
    <details className="card econ-panel">
      <summary className="econ-summary">运营成本与毛利试算（内部）</summary>
      <p className="econ-warn">
        以下为<strong>可变成本 + 固定成本</strong>的简化模型，不含支付手续费、税、人工与营销。模型价默认<strong>占位</strong>，请用
        OpenRouter 控制台、Alpha Vantage 套餐价与云账单<strong>自行替换</strong>后再做定价决策。
      </p>

      <div className="econ-grid">
        <label className="econ-field">
          <span>免费月上限（次/人）</span>
          <input type="number" min={0} value={freeMonthlyCap} onChange={(e) => setFreeMonthlyCap(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>当月活跃免费用户（人）</span>
          <input type="number" min={0} value={freeActiveUsers} onChange={(e) => setFreeActiveUsers(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>免费用户人均实际使用（次，≤上限）</span>
          <input type="number" min={0} value={avgFreeUsesPerUser} onChange={(e) => setAvgFreeUsesPerUser(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>Pro 订户数</span>
          <input type="number" min={0} value={proSubs} onChange={(e) => setProSubs(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>Pro+ 订户数</span>
          <input type="number" min={0} value={proPlusSubs} onChange={(e) => setProPlusSubs(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>假设 Pro 人均月分析次数</span>
          <input type="number" min={0} value={avgProUses} onChange={(e) => setAvgProUses(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>假设 Pro+ 人均月分析次数</span>
          <input type="number" min={0} value={avgProPlusUses} onChange={(e) => setAvgProPlusUses(e.target.value)} />
        </label>
      </div>

      <p className="econ-subtitle">单次分析 Token 假设（主模型 + 领导人 Haiku，股类占比）</p>
      <div className="econ-grid">
        <label className="econ-field">
          <span>主模型 input tokens</span>
          <input type="number" min={0} value={mainIn} onChange={(e) => setMainIn(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>主模型 output tokens</span>
          <input type="number" min={0} value={mainOut} onChange={(e) => setMainOut(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>领导人 Haiku input</span>
          <input type="number" min={0} value={leaderIn} onChange={(e) => setLeaderIn(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>领导人 Haiku output</span>
          <input type="number" min={0} value={leaderOut} onChange={(e) => setLeaderOut(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>触发领导人专项的标的占比（0–1）</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={stockShare}
            onChange={(e) => setStockShare(e.target.value)}
          />
        </label>
      </div>

      <p className="econ-subtitle">模型 $/1M tokens（按你账单填写）</p>
      <div className="econ-grid econ-grid-tight">
        <label className="econ-field">
          <span>Flash input</span>
          <input type="number" step="0.001" value={flashInPerM} onChange={(e) => setFlashInPerM(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>Flash output</span>
          <input type="number" step="0.001" value={flashOutPerM} onChange={(e) => setFlashOutPerM(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>Sonnet input</span>
          <input type="number" step="0.01" value={sonnetInPerM} onChange={(e) => setSonnetInPerM(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>Sonnet output</span>
          <input type="number" step="0.01" value={sonnetOutPerM} onChange={(e) => setSonnetOutPerM(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>Haiku input</span>
          <input type="number" step="0.001" value={haikuInPerM} onChange={(e) => setHaikuInPerM(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>Haiku output</span>
          <input type="number" step="0.001" value={haikuOutPerM} onChange={(e) => setHaikuOutPerM(e.target.value)} />
        </label>
      </div>

      <div className="econ-grid">
        <label className="econ-field">
          <span>每次分析 Alpha Vantage 调用次数（均值）</span>
          <input type="number" min={0} step="0.1" value={avCallsPerAnalysis} onChange={(e) => setAvCallsPerAnalysis(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>折合每次分析 AV 成本（USD，可填 0）</span>
          <input type="number" min={0} step="0.001" value={avUsdPerAnalysis} onChange={(e) => setAvUsdPerAnalysis(e.target.value)} />
        </label>
        <label className="econ-field">
          <span>固定月成本（服务器/域名等 USD）</span>
          <input type="number" min={0} step="1" value={fixedMonthlyUsd} onChange={(e) => setFixedMonthlyUsd(e.target.value)} />
        </label>
      </div>

      <div className="econ-results">
        <p>
          <strong>边际成本（估算）</strong> · 免费/Pro 单次（Flash 主模）：{fmt(out.marginalFreeOrPro)} · Pro+ 单次（Sonnet）：{' '}
          {fmt(out.marginalProPlus)}
        </p>
        <p>
          <strong>当月分析量</strong> · 免费档：{Math.round(out.freeAnalyses)} 次 · Pro：{Math.round(out.proAnalyses)} 次 · Pro+：
          {Math.round(out.ppAnalyses)} 次
        </p>
        <p>
          <strong>变动成本</strong> {fmt(out.varUsd)} + <strong>固定</strong> {fmt(out.fixed)} = <strong>总成本</strong>{' '}
          {fmt(out.totalCost)}
        </p>
        <p>
          <strong>订阅收入（未扣支付手续费）</strong> {fmt(out.rev)}（Pro 9.99 + Pro+ 19.99 标价）
        </p>
        <p className={out.margin >= 0 ? 'econ-margin-pos' : 'econ-margin-neg'}>
          <strong>粗毛利</strong> {fmt(out.margin)}（收入 − 总成本）
        </p>
      </div>
    </details>
  )
}
