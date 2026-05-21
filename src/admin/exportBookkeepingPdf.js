import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/**
 * Render an off-screen DOM node to a multi-page A4 PDF and trigger download.
 * @param {HTMLElement} element
 * @param {string} filename
 */
export async function exportBookkeepingPdf(element, filename = 'wenap-bookkeeping.pdf') {
  if (!element) throw new Error('PDF_ELEMENT_MISSING')

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}
