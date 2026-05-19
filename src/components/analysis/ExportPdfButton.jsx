import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './MobileAnalysisReport.css'

/**
 * Pro+ exclusive PDF export button.
 * Uses window.print() with a print-optimised CSS class on the root element.
 * A future server-side puppeteer endpoint can replace this.
 */
export default function ExportPdfButton({ report }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  if (!report) return null

  const handleExport = async () => {
    setBusy(true)
    try {
      // Add print mode class to enable print-specific styles
      document.body.classList.add('wenap-print-mode')
      window.print()
    } finally {
      document.body.classList.remove('wenap-print-mode')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="ma-pdf-export-btn"
      onClick={handleExport}
      disabled={busy}
    >
      {busy ? t('report.proPlus.pdfExporting') : t('report.proPlus.pdfExport')}
    </button>
  )
}
