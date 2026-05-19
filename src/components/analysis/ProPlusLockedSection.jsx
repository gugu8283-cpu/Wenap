import './MobileAnalysisReport.css'

export default function ProPlusLockedSection({ hints = {}, onUpgrade }) {
  const h = hints || {}
  const any =
    h.hasBullBear || h.hasScenarioDetail || h.hasSupplyDetail
  if (!any) return null

  return (
    <div className="ma-card ma-pro-plus-locked">
      <h2 className="ma-section-title">Pro+ 深度</h2>
      {h.hasBullBear ? (
        <p className="ma-pro-blur-item">多空对撞 · 看多/看空各 3 条附权重…</p>
      ) : null}
      {h.hasScenarioDetail ? (
        <p className="ma-pro-blur-item">情景细化 · 触发价位与时间窗口…</p>
      ) : null}
      {h.hasSupplyDetail ? (
        <p className="ma-pro-blur-item">产业链联动 · 关联标的独立评分…</p>
      ) : null}
      <button type="button" className="ma-pro-field-cta" onClick={onUpgrade}>
        升级 Pro+ 查看
      </button>
    </div>
  )
}
