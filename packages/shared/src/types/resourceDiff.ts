/**
 * The shape of "what changed between two runs of the same page".
 *
 * The *algorithm* stays in `apps/backend/src/lib/resourceDiff.ts` — it needs URL parsing
 * and noise thresholds that only the server applies. What lives here is the wire shape,
 * because the diff is no longer only prompt evidence: it is attached to the result as
 * `AnalysisResult.previous.resourceDiff` and rendered by the analyzer, so the browser
 * needs the type without pulling the server's implementation across the boundary.
 */

export interface DiffableResource {
  url:          string
  transferSize: number
  resourceType: string
}

export interface DiffableLibrary {
  name: string
}

export interface DiffableVendor {
  name:           string
  transferSize:   number
  mainThreadTime: number
}

export interface ResourceSnapshot {
  requests:          DiffableResource[]
  detectedLibraries: DiffableLibrary[]
  thirdParty:        DiffableVendor[]
}

/** One resource that changed size between the two runs. */
export interface ResourceResize {
  url:          string
  resourceType: string
  fromBytes:    number
  toBytes:      number
}

export interface ResourceDiff {
  added:             DiffableResource[]
  removed:           DiffableResource[]
  grown:             ResourceResize[]
  shrunk:            ResourceResize[]
  librariesAdded:    string[]
  librariesRemoved:  string[]
  vendorsAdded:      string[]
  vendorsRemoved:    string[]
}
