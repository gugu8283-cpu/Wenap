import './MobileAnalysisReport.css'

export default function ErrorCard({ onRetry }) {
  return (
    <div className="ma-card ma-error-card" role="alert">
      <div style={{ fontSize: 32 }} aria-hidden>
        ⚠️
      </div>
      <p style={{ margin: '12px 0 0', fontWeight: 500 }}>分析生成失败</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  )
}
