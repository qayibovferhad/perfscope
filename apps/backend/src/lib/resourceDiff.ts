/**
 * "What changed since last time", named down to the file — the follow-on to phase 1's
 * "give the model evidence" applied to the *comparison*, not just the single audit.
 *
 * `analysePage` already knew the previous run's scores and metrics, so it could say a
 * metric moved; it never knew *why*, which is the more useful sentence ("LCP moved
 * because you shipped a 400KB hero image, not just LCP moved"). This is the pure diff —
 * no I/O, so it is cheap to unit test — that makes that sentence possible.
 */
import { pathOf } from './url.js'
import type {
  AnalysisResult,
  DiffableResource,
  ResourceDiff,
  ResourceSnapshot,
} from '@perfscope/shared'

// The shapes moved to `@perfscope/shared/types/resourceDiff` when the diff stopped being
// prompt-only evidence and started riding on the result the browser renders. Re-exported
// here so the existing `from '../lib/resourceDiff.js'` imports keep resolving.
export type {
  DiffableResource,
  DiffableLibrary,
  DiffableVendor,
  ResourceSnapshot,
  ResourceResize,
  ResourceDiff,
} from '@perfscope/shared'

/**
 * The current run, in the shape the diff compares.
 *
 * Three callers built this same object literal inline — the AI page context, the
 * regression note, and now the summary attached to the result. They must agree: a diff
 * that counted third parties in one place and not another would have the alert and the
 * page describing different changes.
 */
export function snapshotOf(result: AnalysisResult): ResourceSnapshot {
  return {
    requests:          result.resources?.requests ?? [],
    detectedLibraries: result.resources?.detectedLibraries ?? [],
    thirdParty:        result.thirdParty ?? [],
  }
}

/** A resize has to clear both an absolute and a relative bar to count — a 2KB→2.3KB blip
 *  on a tracking pixel is not a finding, and neither is a 1% wobble on a 4MB video. */
const GROWTH_MIN_BYTES = 5 * 1024
const GROWTH_MIN_RATIO = 0.15

/** Evidence is only as useful as it is skimmable — cap each list the same way phase 1
 *  capped audit details. */
const TOP_N = 5

/**
 * Ad and tracking endpoints append a fresh cache-buster to their query string on every
 * single page load (`pubads_impl.js?cb=122880269` one run, `?cb=122880346` the next, same
 * script) — keying the diff on the raw URL would report that as a removed request and an
 * added one on every audit of every page that carries one, which is noise, not a finding.
 * Identity for the diff is origin+pathname; the query string is dropped only for matching,
 * never for display.
 */
function resourceKey(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url.split('?')[0] ?? url
  }
}

export function diffResources(current: ResourceSnapshot, previous: ResourceSnapshot): ResourceDiff {
  const curByUrl  = new Map(current.requests.map(r => [resourceKey(r.url), r]))
  const prevByUrl = new Map(previous.requests.map(r => [resourceKey(r.url), r]))

  const added: DiffableResource[] = []
  const grown: ResourceDiff['grown'] = []
  const shrunk: ResourceDiff['shrunk'] = []

  for (const [key, cur] of curByUrl) {
    const prev = prevByUrl.get(key)
    if (!prev) { added.push(cur); continue }

    const delta = cur.transferSize - prev.transferSize
    const base  = Math.max(prev.transferSize, 1)
    if (delta >= GROWTH_MIN_BYTES && delta / base >= GROWTH_MIN_RATIO) {
      grown.push({ url: cur.url, resourceType: cur.resourceType, fromBytes: prev.transferSize, toBytes: cur.transferSize })
    } else if (-delta >= GROWTH_MIN_BYTES && -delta / base >= GROWTH_MIN_RATIO) {
      shrunk.push({ url: cur.url, resourceType: cur.resourceType, fromBytes: prev.transferSize, toBytes: cur.transferSize })
    }
  }

  const removed: DiffableResource[] = []
  for (const [key, prev] of prevByUrl) {
    if (!curByUrl.has(key)) removed.push(prev)
  }

  const bySize = (a: DiffableResource, b: DiffableResource) => b.transferSize - a.transferSize
  const byGrowthMagnitude = (a: ResourceDiff['grown'][number], b: ResourceDiff['grown'][number]) =>
    Math.abs(b.toBytes - b.fromBytes) - Math.abs(a.toBytes - a.fromBytes)

  const curLibs  = new Set(current.detectedLibraries.map(l => l.name))
  const prevLibs = new Set(previous.detectedLibraries.map(l => l.name))
  const curVendors  = new Set(current.thirdParty.map(v => v.name))
  const prevVendors = new Set(previous.thirdParty.map(v => v.name))

  return {
    added:            added.sort(bySize).slice(0, TOP_N),
    removed:          removed.sort(bySize).slice(0, TOP_N),
    grown:            grown.sort(byGrowthMagnitude).slice(0, TOP_N),
    shrunk:           shrunk.sort(byGrowthMagnitude).slice(0, TOP_N),
    librariesAdded:   [...curLibs].filter(l => !prevLibs.has(l)),
    librariesRemoved: [...prevLibs].filter(l => !curLibs.has(l)),
    vendorsAdded:     [...curVendors].filter(v => !prevVendors.has(v)),
    vendorsRemoved:   [...prevVendors].filter(v => !curVendors.has(v)),
  }
}

export function resourceDiffHasChanges(diff: ResourceDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0
    || diff.grown.length > 0 || diff.shrunk.length > 0
    || diff.librariesAdded.length > 0 || diff.librariesRemoved.length > 0
    || diff.vendorsAdded.length > 0 || diff.vendorsRemoved.length > 0
}

/**
 * The diff as lines a prompt can read — one line per kind of change, files named.
 *
 * Lives here rather than in the one caller because two prompts now need the same
 * evidence in the same shape: `analysePage`'s "what changed since that run" block and
 * the note that goes out with a regression alert. Two formatters would drift, and the
 * alert would end up describing the change differently from the page that caused it.
 *
 * Unindented: `buildPageContext` nests these under a heading, an alert lists them flat.
 */
export function formatResourceDiff(diff: ResourceDiff): string[] {
  const kb   = (b: number) => `${Math.round(b / 1024)}KB`
  const name = (url: string) => pathOf(url, url).trim() || url

  const lines: string[] = []
  if (diff.added.length)   lines.push(`Added: ${diff.added.map(r => `${name(r.url)} (${kb(r.transferSize)})`).join(', ')}`)
  if (diff.removed.length) lines.push(`Removed: ${diff.removed.map(r => name(r.url)).join(', ')}`)
  if (diff.grown.length)   lines.push(`Grew: ${diff.grown.map(r => `${name(r.url)} ${kb(r.fromBytes)}→${kb(r.toBytes)}`).join(', ')}`)
  if (diff.shrunk.length)  lines.push(`Shrunk: ${diff.shrunk.map(r => `${name(r.url)} ${kb(r.fromBytes)}→${kb(r.toBytes)}`).join(', ')}`)
  if (diff.librariesAdded.length)   lines.push(`New libraries: ${diff.librariesAdded.join(', ')}`)
  if (diff.librariesRemoved.length) lines.push(`Removed libraries: ${diff.librariesRemoved.join(', ')}`)
  if (diff.vendorsAdded.length)     lines.push(`New vendors: ${diff.vendorsAdded.join(', ')}`)
  if (diff.vendorsRemoved.length)   lines.push(`Removed vendors: ${diff.vendorsRemoved.join(', ')}`)
  return lines
}
