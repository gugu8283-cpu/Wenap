/** Web-search integrity blocks for main analysis prompt (PROMPT-01 / PROMPT-02). */

const { accuracyTrustPromptBlock } = require('./reportAccuracy.cjs');

function searchIntegrityBlock(loc) {
  const zh = loc.startsWith('zh');
  if (zh) {
    return `
【搜索规则】
1. 对每个关键事件，必须同时检索正反两面：
   - 正面："{事件} 批准 OR 成功 OR 利好"
   - 反面："{事件} 拒绝 OR 失败 OR 风险 OR 反转 OR 最新进展"
2. 地缘政治/出口管制类：同时查出口国政策与进口国实际执行（海关、入境、出货、禁令）。
3. 区分「政策批准」与「实际出货」：有批准 ≠ 有出货，须单独核实交易/交付事实。
4. 矛盾报道以**最新日期**为准，并在 note/outlook 中注明「存在争议，以最新信息为准」。
5. 涉及跨境供应链时，执行【地缘政治专项搜索】（见下）。

【地缘政治专项搜索】
若标的涉跨境业务/出口/供应链，额外检索：
- "{商品/技术} {目标国} 海关 OR 进口 OR 实际出货 OR 入境"
- "{目标国} 政府 {商品} 禁令 OR 限制 OR 替代"
- "actual shipment OR delivery OR import ban {ticker}"
输出时区分：政策状态（批准/待审/被拒）与实际执行（已出货/零出货/被拦截）；两者不一致须标注「⚠️ 政策与实际执行存在差距」。`;
  }
  return `
【Search rules】
1. For each key event, search both sides: approval/success vs rejection/failure/risk/reversal/latest update.
2. Geopolitics / export controls: verify exporter policy AND importer enforcement (customs, entry, shipments, bans).
3. Policy approval ≠ actual shipment; verify delivery separately.
4. If sources conflict, prefer the newest dated report and state that explicitly.
5. Cross-border supply chains: run the geo-special search below.

【Geopolitics special search】
When relevant, also search actual shipment / import ban / customs for the destination country.
Label policy status vs execution status; if they diverge, flag "policy vs execution gap".`;
}

function sourceFreshnessBlock(loc) {
  const zh = loc.startsWith('zh');
  if (zh) {
    return `
【来源时效规则】
1. sources[].time 必填来源日期（YYYY-MM-DD 或 YYYY-MM）。
2. 超过 14 天的关键事实，在 text 末尾标注「⚠️ 信息可能过时」。
3. 发现更新报道与旧信息矛盾，以新报道为准并在 outlook 或对应维度 note 说明。
4. 地缘政治/政策类：有效期 7 天；基本面/财务类：90 天。
5. 禁止引用无日期来源支撑的关键数字。
6. 财报/估值倍数：须注明财报期（如 FY2025 Q3）；超过 90 天的财务快照不得当作「最新业绩」。
7. 社交媒体传闻、匿名帖：credibility 标「低」，且不得单独支撑 BUY/SELL。`;
  }
  return `
【Source freshness】
1. Every sources[].time must be a concrete date.
2. Key facts older than 14 days: append "⚠️ may be stale" in sources[].text.
3. Prefer newer reports when contradictions exist; explain in outlook or dimension notes.
4. Policy/geo: 7-day relevance; fundamentals: 90 days.
5. Do not cite undated sources for critical numbers.
6. Fundamentals must name the fiscal period; do not present >90d filings as "latest earnings".
7. Social/rumor sources: low credibility only; never sole basis for BUY/SELL.`;
}

module.exports = { searchIntegrityBlock, sourceFreshnessBlock, accuracyTrustPromptBlock };
