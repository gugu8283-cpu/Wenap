/** 与 App  props / JSON 样例对齐的 TS 形状（供参考；主代码为 JSX + JSDoc） */

export interface MobileDimension {
  name: string
  score: number
  reason: string
  color: string
}

export interface MobileScenario {
  type: 'bull' | 'base' | 'bear'
  probability: number
  rangeMin: number
  rangeMax: number
  rangeLabel?: string
  trigger: string
}

export interface MobileSupplyRow {
  code: string
  /** 可点击发起分析的代码；空表示无可靠代码 */
  analyzeCode?: string
  name: string
  exchange: string
  relation: string
  score: number
}

export interface MobileSource {
  title: string
  source: string
  date: string
  credibility: 'high' | 'mid' | 'low'
  url: string
}

export interface MobileReport {
  ticker: string
  name: string
  exchange: string
  generatedAt: string
  dataAsOf: string
  score: number
  tendency: 'buy' | 'hold' | 'sell'
  risk: string
  riskReward: string
  currentPrice?: number
  targetPrice?: number
  upside?: number
  summary: string
  technicalSnapshot: string
  dimensions: MobileDimension[]
  scenarios: MobileScenario[]
  supplyChain: MobileSupplyRow[]
  forecast: string
  forecastAssumption: string
  sources: MobileSource[]
  sourceCount: number
  timeSaved: number
}
