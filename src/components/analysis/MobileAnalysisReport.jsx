import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { snapshotToMobileReport } from '../../utils/snapshotToMobileReport.js'
import './MobileAnalysisReport.css'
import HeroCard from './HeroCard.jsx'
import RadarSection from './RadarSection.jsx'
import ScenarioSection from './ScenarioSection.jsx'
import SupplyChainSection from './SupplyChainSection.jsx'
import ForecastCard from './ForecastCard.jsx'
import SourcesAccordion from './SourcesAccordion.jsx'
import ProFieldsSection from './ProFieldsSection.jsx'
import ProPlusLockedSection from './ProPlusLockedSection.jsx'
import BullBearSection from './BullBearSection.jsx'
import ProUpgradeBar from './ProUpgradeBar.jsx'
import Skeleton, { HeroSkeleton, RadarSkeleton, BlockSkeleton } from './Skeleton.jsx'

const SECTION_COUNT = 9

export default function MobileAnalysisReport({
  snapshot,
  meta = {},
  ticker = '',
  quotaBanner = null,
  subscribeUrl = '',
  loading = false,
  onAnalyzeSymbol,
  onDevUnlock,
  onCompareToast,
}) {
  const { t } = useTranslation()
  const report = useMemo(
    () => snapshotToMobileReport(snapshot, { ...meta, fallbackTicker: ticker }),
    [snapshot, meta, ticker],
  )

  const targetPriceMismatch = useMemo(() => {
    if (!report?.scenarios?.length || !Number.isFinite(report.targetPrice)) return false
    const bull = report.scenarios.find((s) => s.type === 'bull')
    if (!bull || !Number.isFinite(bull.rangeMin) || !Number.isFinite(bull.rangeMax)) return false
    const tp = report.targetPrice
    if (tp < bull.rangeMin || tp > bull.rangeMax) {
      console.warn('[Wenap] 目标价不在牛势区间内，数据可能有误')
      return true
    }
    return false
  }, [report])

  const [revealed, setRevealed] = useState(0)
  const revealKey = report ? `${report.ticker}|${report.dataAsOf}|${report.generatedAt}` : ''

  useEffect(() => {
    if (!revealKey) return undefined
    const timers = [setTimeout(() => setRevealed(0), 0)]
    for (let i = 1; i <= SECTION_COUNT; i++) {
      timers.push(setTimeout(() => setRevealed(i), i * 90))
    }
    return () => timers.forEach(clearTimeout)
  }, [revealKey])

  const tier = snapshot?.reportTier || report?.reportTier || 'free'
  const isFree = tier === 'free'
  const isPro = tier === 'pro'
  const isProPlus = tier === 'pro_plus'

  const onUpgrade = () => {
    const u = String(subscribeUrl || '').trim()
    if (u) window.open(u, '_blank', 'noopener,noreferrer')
    else if (onDevUnlock) onDevUnlock()
  }

  const onCompare = () => {
    if (onCompareToast) onCompareToast()
    else window.alert(t('report.compareComingSoon'))
  }

  if (loading && !report) {
    return (
      <div className="mobile-analysis-root">
        <Skeleton phase={4} />
      </div>
    )
  }

  if (!report) return null

  const vis = (n) => revealed >= n
  const eventTeaser = report.proFieldHints?.catalystCount || 0

  return (
    <div className="mobile-analysis-root">
      {vis(1) ? (
        <HeroCard report={report} showCompare={false} onCompare={onCompare} />
      ) : (
        <HeroSkeleton />
      )}
      {vis(2) ? <RadarSection dimensions={report.dimensions} /> : <RadarSkeleton />}
      {vis(3) ? (
        <ScenarioSection scenarios={report.scenarios} currentPrice={report.currentPrice} />
      ) : (
        <BlockSkeleton h={100} />
      )}
      {vis(4) ? (
        report.supplyChain?.length ? (
          <SupplyChainSection rows={report.supplyChain} onAnalyzeCode={onAnalyzeSymbol} />
        ) : null
      ) : report.supplyChain?.length ? (
        <BlockSkeleton h={72} />
      ) : null}
      {vis(5) ? (
        isProPlus ? (
          <BullBearSection bullBearDebate={report.bullBearDebate} />
        ) : isPro ? (
          <ProPlusLockedSection hints={report.proPlusFieldHints} onUpgrade={onUpgrade} />
        ) : null
      ) : null}
      {vis(6) ? (
        <ProFieldsSection
          report={report}
          locked={isFree}
          onUpgrade={onUpgrade}
          keyEventsTeaserCount={eventTeaser}
        />
      ) : (
        <BlockSkeleton h={72} />
      )}
      {vis(7) ? (
        <ForecastCard
          forecast={report.forecast}
          assumption={report.forecastAssumption}
          technicalSnapshot={report.technicalSnapshot}
        />
      ) : (
        <BlockSkeleton h={88} />
      )}
      {vis(8) ? (
        <>
          {targetPriceMismatch ? (
            <p className="ma-target-mismatch-warn">⚠️ {t('report.targetMismatch')}</p>
          ) : null}
          <SourcesAccordion
            sources={report.sources}
            sourceCount={report.sourceCount}
            timeSaved={report.timeSaved}
          />
        </>
      ) : (
        <BlockSkeleton h={48} />
      )}
      {isFree ? (
        <ProUpgradeBar quotaBanner={quotaBanner} subscribeUrl={subscribeUrl} onDevUnlock={onDevUnlock} />
      ) : null}
    </div>
  )
}
