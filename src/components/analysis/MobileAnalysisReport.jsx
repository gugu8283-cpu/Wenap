import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { snapshotToMobileReport } from '../../utils/snapshotToMobileReport.js'
import './MobileAnalysisReport.css'
import HeroCard from './HeroCard.jsx'
import TrustBanner from './TrustBanner.jsx'
import CoreConclusionCard from './CoreConclusionCard.jsx'
import KeyLevelsSection from './KeyLevelsSection.jsx'
import AccuracyTeaser from './AccuracyTeaser.jsx'
import SocialProofBanner from '../conversion/SocialProofBanner.jsx'
import AhaMomentCard, { shouldShowAha, markAhaSeen } from '../conversion/AhaMomentCard.jsx'
import QuotaSoftNudge from '../conversion/QuotaSoftNudge.jsx'
import RadarSection from './RadarSection.jsx'
import ScenarioSection from './ScenarioSection.jsx'
import SupplyChainSection from './SupplyChainSection.jsx'
import ForecastCard from './ForecastCard.jsx'
import SourcesAccordion from './SourcesAccordion.jsx'
import ProFieldsSection from './ProFieldsSection.jsx'
import ProPlusLockedSection from './ProPlusLockedSection.jsx'
import BullBearSection from './BullBearSection.jsx'
import ProUpgradeBar from './ProUpgradeBar.jsx'
import CritiqueSection from './CritiqueSection.jsx'
import { buildCritiquePayload } from '../../utils/buildCritiquePayload.js'
import ExportPdfButton from './ExportPdfButton.jsx'
import EnrichmentSection from './EnrichmentSection.jsx'
import ProAdvancedPanel from './ProAdvancedPanel.jsx'
import Skeleton, { HeroSkeleton, RadarSkeleton, BlockSkeleton } from './Skeleton.jsx'

const SECTION_COUNT = 10
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

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
  onRequestUpgrade,
}) {
  const { t, i18n } = useTranslation()
  const isJa = String(i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('ja')
  const report = useMemo(
    () =>
      snapshotToMobileReport(snapshot, {
        ...meta,
        fallbackTicker: ticker,
        locale: i18n.language,
      }),
    [snapshot, meta, ticker, i18n.language],
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
  const [scorePercentile, setScorePercentile] = useState(null)
  const [showAha, setShowAha] = useState(() => shouldShowAha())
  const revealKey = report ? `${report.ticker}|${report.dataAsOf}|${report.generatedAt}` : ''

  useEffect(() => {
    if (!revealKey) return undefined
    const timers = [setTimeout(() => setRevealed(0), 0)]
    for (let i = 1; i <= SECTION_COUNT; i++) {
      timers.push(setTimeout(() => setRevealed(i), i * 90))
    }
    return () => timers.forEach(clearTimeout)
  }, [revealKey])

  useEffect(() => {
    if (!report?.score) return undefined
    const base = API_BASE.replace(/\/$/, '')
    let cancelled = false
    fetch(`${base}/stats/score-percentile?score=${encodeURIComponent(report.score)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Number.isFinite(j.percentile)) setScorePercentile(j.percentile)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [report?.score, report?.ticker])

  const tier = snapshot?.reportTier || report?.reportTier || 'free'
  const isFree = tier === 'free'
  const isPro = tier === 'pro'
  const isProPlus = tier === 'pro_plus'

  const onUpgrade = () => {
    const u = String(subscribeUrl || '').trim()
    if (u) window.open(u, '_blank', 'noopener,noreferrer')
    else if (onDevUnlock) onDevUnlock()
  }

  const handleUpgrade = () => {
    if (onRequestUpgrade) onRequestUpgrade()
    else onUpgrade()
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

  const bullBearForFree =
    report.bullBearDebate?.bull?.length || report.bullBearDebate?.bear?.length
      ? report.bullBearDebate
      : report.proPlusFieldHints?.hasBullBear
        ? {
            bull: [
              { reason: t('report.proPlus.bullBearTeaser'), weight: '' },
              { reason: '···', weight: '' },
            ],
            bear: [
              { reason: t('report.proPlus.bullBearTeaser'), weight: '' },
              { reason: '···', weight: '' },
            ],
          }
        : null

  return (
    <div className="mobile-analysis-root">
      {vis(1) ? (
        <>
          <SocialProofBanner ticker={report.ticker} />
          <HeroCard
            report={report}
            showCompare={false}
            onCompare={onCompare}
            scorePercentile={scorePercentile}
          />
          <TrustBanner
            warnings={report.trustWarnings}
            freshnessScore={report.freshnessScore}
            quoteAsOf={report.quoteAsOf}
            priceAsOfDisplay={report.priceAsOfDisplay}
            priceSource={report.priceSource}
            priceStaleNotice={report.priceStaleNotice}
            dataFieldFreshness={report.dataFieldFreshness}
          />
          {isJa ? <p className="ma-trust-foot">{t('legal.jaFsaReport')}</p> : null}
        </>
      ) : (
        <HeroSkeleton />
      )}
      {vis(2) ? <CoreConclusionCard conclusion={report.coreConclusion} /> : null}
      {showAha && vis(2) ? (
        <AhaMomentCard
          sourceCount={report.sourceCount}
          hasRiskBlindSpot={Boolean(report.riskBlindSpot)}
          onDismiss={() => {
            markAhaSeen()
            setShowAha(false)
          }}
        />
      ) : null}
      {vis(3) ? <RadarSection dimensions={report.dimensions} /> : <RadarSkeleton />}
      {vis(3) && !isFree && (snapshot?.macroSnapshot || snapshot?.technicals) ? (
        <EnrichmentSection macroSnapshot={snapshot.macroSnapshot} technicals={snapshot.technicals} />
      ) : null}
      {vis(4) ? (
        <ScenarioSection
          scenarios={report.scenarios}
          currentPrice={report.currentPrice}
          locked={isFree}
          onUpgrade={handleUpgrade}
        />
      ) : (
        <BlockSkeleton h={100} />
      )}
      {vis(5) ? (
        report.supplyChain?.length ? (
          <SupplyChainSection
            rows={report.supplyChain}
            sectionTitleKey={report.supplyChainSectionKey || 'report.supplyChain'}
            onAnalyzeCode={onAnalyzeSymbol}
            previewMode={isFree}
            onUpgrade={handleUpgrade}
          />
        ) : null
      ) : report.supplyChain?.length ? (
        <BlockSkeleton h={72} />
      ) : null}
      {vis(6) ? (
        isProPlus ? (
          <BullBearSection bullBearDebate={report.bullBearDebate} />
        ) : isPro ? (
          <ProPlusLockedSection
            hints={report.proPlusFieldHints}
            onUpgrade={handleUpgrade}
            ticker={report.ticker}
          />
        ) : bullBearForFree ? (
          <BullBearSection
            bullBearDebate={bullBearForFree}
            previewMode
            onUpgrade={handleUpgrade}
          />
        ) : null
      ) : null}
      {report.keyLevels?.length ? (
        <KeyLevelsSection
          levels={report.keyLevels}
          listingCurrency={report.listingCurrency}
          currentPrice={report.currentPrice}
        />
      ) : null}
      {isProPlus ? <ProAdvancedPanel ticker={report.ticker} tier={tier} /> : null}
      {vis(7) ? (
        <ProFieldsSection
          report={report}
          locked={isFree}
          onUpgrade={handleUpgrade}
          keyEventsTeaserCount={eventTeaser}
        />
      ) : (
        <BlockSkeleton h={72} />
      )}
      {vis(8) ? (
        <ForecastCard
          forecast={report.forecast}
          assumption={report.forecastAssumption}
          technicalSnapshot={report.technicalSnapshot}
        />
      ) : (
        <BlockSkeleton h={88} />
      )}
      {vis(9) ? (
        <>
          {targetPriceMismatch ? (
            <p className="ma-target-mismatch-warn">⚠️ {t('report.targetMismatch')}</p>
          ) : null}
          <SourcesAccordion
            sources={report.sources}
            sourceCount={report.sourceCount}
            timeSaved={report.timeSaved}
          />
          <AccuracyTeaser />
        </>
      ) : (
        <BlockSkeleton h={48} />
      )}
      {(() => {
        const critique = buildCritiquePayload(report)
        if (!critique) return null
        const total =
          (critique.blindSpot ? 1 : 0) + (critique.weaknesses?.length || 0)
        if (isProPlus) {
          return (
            <CritiqueSection
              critique={critique}
              subtitle={t('report.proPlus.critiqueSub')}
            />
          )
        }
        if (isPro) {
          return (
            <CritiqueSection
              critique={critique}
              subtitle={t('report.critiqueSubPro')}
            />
          )
        }
        return (
          <CritiqueSection
            critique={critique}
            subtitle={t('report.critiqueSubPreview')}
            previewMode
            lockedCount={Math.max(1, total - 1)}
            onUpgrade={handleUpgrade}
          />
        )
      })()}
      {isProPlus ? (
        <div className="ma-pro-plus-actions">
          <ExportPdfButton report={report} />
        </div>
      ) : null}
      {isFree ? (
        <>
          <QuotaSoftNudge
            quotaBanner={quotaBanner}
            ticker={report.ticker}
            onUpgrade={handleUpgrade}
          />
          <ProUpgradeBar quotaBanner={quotaBanner} subscribeUrl={subscribeUrl} onDevUnlock={onDevUnlock} />
        </>
      ) : null}
    </div>
  )
}
