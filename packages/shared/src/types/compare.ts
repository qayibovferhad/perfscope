/** One stored side-by-side comparison run, as served by /api/compare-history. */
export interface CompareEntry {
  id:             string
  pairId:         string
  sourceUrl:      string
  targetUrl:      string
  sourceHostname: string
  targetHostname: string
  source:         { scores: Record<string, number>; metrics: Record<string, number> }
  competitor:     { scores: Record<string, number>; metrics: Record<string, number> }
  winner:         'source' | 'competitor' | 'tie'
  timestamp:      string
}
