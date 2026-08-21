/**
 * Render the on-screen report element into a branded A4 PDF. Mirrors
 * `features/history/lib/export.ts`, which owns the JSON/CSV equivalents — 30 lines of
 * html2canvas + jsPDF plumbing that used to sit inline in the panel component. Both
 * libraries are imported lazily so they stay out of the main bundle until someone
 * actually exports.
 */
export async function exportComparePdf(
  el: HTMLElement,
  pair: { sourceHostname: string; targetHostname: string },
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: isDark ? '#0e1712' : '#ffffff', useCORS: true, logging: false,
  });
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pW  = pdf.internal.pageSize.getWidth();
  const pH  = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(14, 23, 18); pdf.rect(0, 0, pW, pH, 'F');
  pdf.setTextColor(20, 192, 138); pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
  pdf.text('PerfScope', 12, 14);
  pdf.setTextColor(174, 188, 180); pdf.setFontSize(9); pdf.setFont('helvetica', 'normal');
  pdf.text(`${pair.sourceHostname} vs ${pair.targetHostname}`, 12, 28);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, 12, 34);
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgW    = pW - 24;
  const imgH    = Math.min((canvas.height / canvas.width) * imgW, pH - 50);
  pdf.addImage(imgData, 'JPEG', 12, 42, imgW, imgH);
  pdf.save(`perfscope-${pair.sourceHostname}-vs-${pair.targetHostname}-${Date.now()}.pdf`);
}
