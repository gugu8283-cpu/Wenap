import './MobileAnalysisReport.css'

/** Inline upgrade prompt below a section (no blur). */
export default function ProLockPrompt({ text, onUnlock }) {
  if (!text) return null
  return (
    <button type="button" className="ma-tier-lock-prompt" onClick={onUnlock}>
      <span className="ma-tier-lock-badge">Pro</span>
      <span>{text}</span>
    </button>
  )
}
