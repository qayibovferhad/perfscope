/**
 * Hand the browser a file to save. One definition: the history export owned the correct
 * version (revoking the object URL) while the analyzer page had re-inlined its own.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
