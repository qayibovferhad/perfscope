/**
 * One side of a stored comparison. Loose maps rather than the strict score/vital shapes
 * on purpose: a side can arrive from an uploaded report as well as a live run, and the
 * stored rows predate today's field lists. This shape used to be written out inline in
 * seven places across the backend and this file.
 */
export interface ComparisonSide {
  scores:  Record<string, number>
  metrics: Record<string, number>
}

/** One stored side-by-side comparison run, as served by /api/compare-history. */
export interface CompareEntry {
  id:             string
  pairId:         string
  sourceUrl:      string
  targetUrl:      string
  sourceHostname: string
  targetHostname: string
  source:         ComparisonSide
  competitor:     ComparisonSide
  winner:         'source' | 'competitor' | 'tie'
  timestamp:      string
  /**
   * Two or three sentences on who wins and what to attack first, written when the
   * comparison was saved. Absent for comparisons stored before this existed, and whenever
   * Gemini was unavailable.
   */
  aiVerdict?:     string
}
