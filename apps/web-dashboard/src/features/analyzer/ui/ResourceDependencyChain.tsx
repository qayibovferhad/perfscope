import { useMemo, memo } from 'react'
import { GitBranch, AlertTriangle } from 'lucide-react'
import { Panel, PanelHeader } from '@/shared/ui/panel'
import { cn } from '@/shared/lib/utils'
import { fmtMs, fmtBytes } from '@/shared/lib/format'
import { RESOURCE_TYPES } from '@/entities/analysis'
import type { DependencyGraph, DependencyNode, ResourceType, NetworkRequest } from '@/entities/analysis'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DEPTH = 5
const MAX_ROWS  = 40
const INDENT_PX = 22

// ─── Legend ───────────────────────────────────────────────────────────────────

/** The types worth naming in the legend; colours come from RESOURCE_TYPES. */
const LEGEND_TYPES: ResourceType[] = ['document', 'script', 'stylesheet', 'font', 'image']

const LEGEND_LABELS: Partial<Record<ResourceType, string>> = {
  document: 'Document', script: 'Script', stylesheet: 'Stylesheet', font: 'Font', image: 'Image',
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface TreeNode {
  url:          string
  label:        string
  resourceType: ResourceType
  transferSize: number
  duration:     number
  children:     TreeNode[]
}

interface FlatRow {
  node:       TreeNode
  depth:      number
  isLast:     boolean
  lineFlags:  boolean[]
  isCritical: boolean
  isRoot:     boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(url: string): string {
  try {
    const u    = new URL(url)
    const file = u.pathname.split('/').pop()?.replace(/\?.*$/, '') ?? ''
    return file || u.hostname
  } catch {
    return url.split('/').pop()?.replace(/\?.*$/, '') ?? url
  }
}

// ─── Tree building ────────────────────────────────────────────────────────────

function buildTree(graph: DependencyGraph, reqMap: Map<string, NetworkRequest>): TreeNode | null {
  if (!graph.nodes.length || !graph.links.length) return null

  const nodeMap   = new Map<string, DependencyNode>(graph.nodes.map(n => [n.url, n]))
  const childUrls = new Map<string, string[]>()
  const inDeg     = new Map<string, number>()

  for (const n of graph.nodes) {
    childUrls.set(n.url, [])
    inDeg.set(n.url, 0)
  }
  for (const lk of graph.links) {
    if (!childUrls.has(lk.source)) childUrls.set(lk.source, [])
    childUrls.get(lk.source)!.push(lk.target)
    inDeg.set(lk.target, (inDeg.get(lk.target) ?? 0) + 1)
    if (!inDeg.has(lk.source)) inDeg.set(lk.source, 0)
  }

  // Root: prefer document with 0 in-degree
  let rootUrl: string | null = null
  for (const n of graph.nodes) {
    if (n.resourceType === 'document' && (inDeg.get(n.url) ?? 0) === 0) {
      rootUrl = n.url
      break
    }
  }
  // Fallback: 0-in-degree node with most children
  if (!rootUrl) {
    let maxC = -1
    for (const [url, deg] of inDeg) {
      if (deg === 0) {
        const c = childUrls.get(url)?.length ?? 0
        if (c > maxC) { maxC = c; rootUrl = url }
      }
    }
  }
  if (!rootUrl) return null

  const visited = new Set<string>()

  function build(url: string, depth: number): TreeNode | null {
    if (visited.has(url) || depth > MAX_DEPTH) return null
    visited.add(url)

    const n   = nodeMap.get(url)
    const req = reqMap.get(url)
    const dur = req ? Math.max(req.endTime - req.startTime, 0) : 0

    const kids: TreeNode[] = []
    for (const cu of (childUrls.get(url) ?? [])) {
      const child = build(cu, depth + 1)
      if (child) kids.push(child)
    }
    kids.sort((a, b) => b.transferSize - a.transferSize)

    return {
      url,
      label:        n?.label ?? shortLabel(url),
      resourceType: n?.resourceType ?? 'other',
      transferSize: n?.transferSize ?? req?.transferSize ?? 0,
      duration:     dur,
      children:     kids,
    }
  }

  return build(rootUrl, 0)
}

// ─── Critical path ────────────────────────────────────────────────────────────

function findCriticalPath(root: TreeNode): Set<string> {
  function maxPath(node: TreeNode): { total: number; urls: string[] } {
    const self = node.duration > 0 ? node.duration : node.transferSize / 100
    if (!node.children.length) return { total: self, urls: [node.url] }
    let best: { total: number; urls: string[] } = { total: -1, urls: [] }
    for (const child of node.children) {
      const r = maxPath(child)
      if (r.total > best.total) best = r
    }
    return { total: self + best.total, urls: [node.url, ...best.urls] }
  }
  return new Set(maxPath(root).urls)
}

// ─── Flatten ──────────────────────────────────────────────────────────────────

function flattenTree(root: TreeNode, critUrls: Set<string>): FlatRow[] {
  const rows: FlatRow[] = []

  function visit(node: TreeNode, depth: number, lineFlags: boolean[], isLast: boolean) {
    if (rows.length >= MAX_ROWS) return
    rows.push({
      node,
      depth,
      isLast,
      lineFlags,
      isCritical: critUrls.has(node.url) && depth > 0,
      isRoot:     depth === 0,
    })
    for (let i = 0; i < node.children.length; i++) {
      const child     = node.children[i]
      const childLast = i === node.children.length - 1
      // depth-0 children have no ancestor spacers; depth>=1 push whether current node continues
      const newFlags  = depth === 0 ? [] : [...lineFlags, !isLast]
      visit(child, depth + 1, newFlags, childLast)
    }
  }

  visit(root, 0, [], false)
  return rows
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ value, label, rose }: { value: string; label: string; rose?: boolean }) {
  return (
    <div className="px-[15px] py-[13px] rounded-[12px] border border-ld-border bg-ld-surface-2">
      <b className={cn(
        'font-mono text-[22px] font-semibold tracking-tight block leading-none',
        rose ? 'text-ld-rose' : 'text-ld-text',
      )}>
        {value}
      </b>
      <div className="text-[12px] mt-[3px] text-ld-text-2">{label}</div>
    </div>
  )
}

function DepRow({ row, maxTransfer, isFirst }: { row: FlatRow; maxTransfer: number; isFirst: boolean }) {
  const { node, depth, isLast, lineFlags, isCritical, isRoot } = row
  const cfg    = RESOURCE_TYPES[node.resourceType]
  const barPct = maxTransfer > 0 ? Math.round((node.transferSize / maxTransfer) * 100) : 0

  // Bar fill: gradient strings can't be arbitrary Tailwind bg values cleanly → inline
  const barFill = isRoot
    ? 'var(--ld-grad)'
    : isCritical
    ? 'linear-gradient(90deg,var(--ld-rose),#f58aa0)'
    : 'var(--ld-accent-line)'

  return (
    <div
      className={cn(
        'dep-chain-grid items-center px-[12px] py-[9px] rounded-[10px] transition-colors',
        !isFirst && 'border-t border-ld-border',
        isRoot     && 'bg-[rgba(20,192,138,.05)]',
        isCritical && 'bg-ld-rose-wash',
        !isRoot && !isCritical && 'hover:bg-ld-surface-hover',
      )}
      style={{ display: 'grid', gridTemplateColumns: '1fr 130px 76px 70px', gap: 12 }}
    >
      {/* ── Name cell ─────────────────────────────────────────────────────── */}
      <div className="flex items-center min-w-0">
        {/* Ancestor spacers — only when depth >= 2 */}
        {depth > 1 && (
          <span className="flex self-stretch shrink-0">
            {lineFlags.map((hasLine, i) => (
              <i
                key={i}
                className={cn('relative block shrink-0 self-stretch', hasLine && 'dep-indent-line')}
                style={{ width: INDENT_PX }}
              />
            ))}
          </span>
        )}

        {/* Elbow connector */}
        {depth > 0 && (
          <span
            className={cn('dep-elbow-conn relative block shrink-0 self-stretch', isLast && 'dep-elbow-last')}
            style={{ width: INDENT_PX }}
          />
        )}

        {/* Type tag (skip on root) */}
        {!isRoot && (
          <span
            className="font-mono text-[9px] font-semibold px-[5px] py-[2px] rounded-[5px] shrink-0 tracking-[.04em] mr-[6px] leading-none"
            style={{ color: cfg.text, background: cfg.tint }}
          >
            {cfg.label}
          </span>
        )}

        {/* Color dot */}
        <span
          className="w-[9px] h-[9px] rounded-[3px] shrink-0 mr-[9px]"
          style={{ background: cfg.text }}
        />

        {/* Label */}
        <span
          className={cn(
            'font-mono text-[13px] font-medium truncate',
            isRoot     ? 'text-ld-accent-2' : isCritical ? 'text-ld-rose' : 'text-ld-text',
          )}
          title={node.url}
        >
          {node.label || shortLabel(node.url)}
        </span>

        {/* Root suffix */}
        {isRoot && (
          <span className="font-mono text-[10.5px] ml-[8px] shrink-0 text-ld-text-3">document</span>
        )}
      </div>

      {/* ── Transfer bar ──────────────────────────────────────────────────── */}
      <div className="dep-chain-transfer h-[7px] rounded-full overflow-hidden bg-ld-border">
        {/* Width is dynamic → inline; background is a gradient → inline */}
        <i className="block h-full rounded-full" style={{ width: `${barPct}%`, background: barFill }} />
      </div>

      {/* ── Size ──────────────────────────────────────────────────────────── */}
      <span className="dep-chain-size font-mono text-[12px] text-right font-semibold text-ld-text">
        {node.transferSize > 0 ? fmtBytes(node.transferSize) : '—'}
      </span>

      {/* ── Time ──────────────────────────────────────────────────────────── */}
      <span className={cn(
        'font-mono text-[12px] text-right tabular-nums',
        isCritical ? 'text-ld-rose' : 'text-ld-text-3',
      )}>
        {node.duration > 0 ? fmtMs(node.duration) : '—'}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  graph:      DependencyGraph
  resources?: NetworkRequest[]
}

export const ResourceDependencyChain = memo(function ResourceDependencyChain({ graph, resources }: Props) {
  const reqMap = useMemo(
    () => new Map((resources ?? []).map(r => [r.url, r])),
    [resources],
  )

  const derived = useMemo(() => {
    const root = buildTree(graph, reqMap)
    if (!root) return null

    const critUrls = findCriticalPath(root)
    const rows     = flattenTree(root, critUrls)

    const total    = rows.length - 1
    const maxDepth = rows.reduce((m, r) => Math.max(m, r.depth), 0)
    const blocking = rows.filter(
      r => r.isCritical && (r.node.resourceType === 'stylesheet' || r.node.resourceType === 'script'),
    ).length

    const critRows     = rows.filter(r => critUrls.has(r.node.url))
    const critMs       = critRows.reduce((s, r) => s + r.node.duration, 0)
    const critLastNode = critRows.length > 1 ? critRows[critRows.length - 1].node : null
    const maxTransfer  = rows.reduce((m, r) => Math.max(m, r.node.transferSize), 0)

    return { rows, total, maxDepth, blocking, critMs, critLastNode, maxTransfer }
  }, [graph, reqMap])

  if (!derived || !derived.rows.length) return null

  const { rows, total, maxDepth, blocking, critMs, critLastNode, maxTransfer } = derived

  return (
    <Panel>
      <PanelHeader icon={<GitBranch />} title="Resource Dependency Chain" meta="Critical request chains">
        {critMs > 0 && (
          <span className="inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px] border shrink-0 text-ld-rose border-ld-rose-line">
            <span className="w-[7px] h-[7px] rounded-full bg-current shrink-0" />
            Longest chain {fmtMs(critMs)}
          </span>
        )}
      </PanelHeader>

      <div className="px-[18px] py-[16px] space-y-[16px]">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-[12px] max-[480px]:grid-cols-1">
          <StatCard value={String(total)}    label="Resources with dependencies" />
          <StatCard value={String(maxDepth)} label="Chain depth (levels)" />
          <StatCard value={String(blocking)} label="Render-blocking on critical path" rose />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-[14px] gap-y-[6px]">
          {LEGEND_TYPES.map((type) => (
            <span key={type} className="inline-flex items-center gap-[7px] font-mono text-[11px] text-ld-text-3">
              <i
                className="w-[9px] h-[9px] rounded-[3px] block shrink-0"
                style={{ background: RESOURCE_TYPES[type].text }}
              />
              {LEGEND_LABELS[type]}
            </span>
          ))}
        </div>

        {/* Column header + tree */}
        <div>
          <div
            className="dep-chain-grid pb-[9px] border-b border-ld-border"
            style={{ display: 'grid', gridTemplateColumns: '1fr 130px 76px 70px', gap: 12 }}
          >
            {(['Resource', 'Transfer', 'Size', 'Time'] as const).map((h, i) => (
              <span
                key={h}
                className={cn(
                  'font-mono text-[10px] tracking-[.1em] uppercase text-ld-text-3',
                  i >= 2 && 'text-right',
                  i === 1 && 'dep-chain-transfer',
                  i === 2 && 'dep-chain-size',
                )}
              >
                {h}
              </span>
            ))}
          </div>

          <div className="flex flex-col">
            {rows.map((row, idx) => (
              <DepRow key={`${row.node.url}-${idx}`} row={row} maxTransfer={maxTransfer} isFirst={idx === 0} />
            ))}
          </div>
        </div>

        {/* Insight footer */}
        {critLastNode && (
          <div className="flex items-center gap-[9px] px-[15px] py-[12px] rounded-[12px] border bg-ld-rose-wash border-ld-rose-fill">
            <AlertTriangle className="w-[17px] h-[17px] shrink-0 text-ld-rose" />
            <p className="text-[13px] text-ld-text-2">
              <b className="text-ld-text font-semibold">{critLastNode.label}</b>
              {' '}sits at the end of the longest chain — deferring or code-splitting it would shorten time-to-interactive the most.
            </p>
          </div>
        )}
      </div>
    </Panel>
  )
})
