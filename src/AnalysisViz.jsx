import MobileAnalysisReport from './components/analysis/MobileAnalysisReport.jsx'

export default function AnalysisViz({
  snapshot,
  meta,
  ticker,
  quotaBanner,
  subscribeUrl,
  loading,
  onAnalyzeSymbol,
  onDevUnlock,
  onCompareToast,
  onReanalyze,
}) {
  return (
    <MobileAnalysisReport
      snapshot={snapshot}
      meta={meta || {}}
      ticker={ticker || ''}
      quotaBanner={quotaBanner}
      subscribeUrl={subscribeUrl || ''}
      loading={!!loading}
      onAnalyzeSymbol={onAnalyzeSymbol}
      onDevUnlock={onDevUnlock}
      onCompareToast={onCompareToast}
      onReanalyze={onReanalyze}
    />
  )
}
