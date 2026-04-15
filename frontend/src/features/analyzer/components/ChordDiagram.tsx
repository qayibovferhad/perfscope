import { useEffect, useRef, memo, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { DependencyGraph, DependencyNode, ResourceType } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_LIMIT = 50;
const PAD_ANGLE  = 0.04;

/** Virtual root node URL — never appears in real network traffic */
const ROOT_URL   = '__root__';

/**
 * Arc sizes are sqrt(degree)-weighted.
 * A leaf with degree=1 → weight 1.0
 * Root with degree=20  → weight 4.47  (visible but doesn't dominate)
 * This naturally provides a min-width floor: sqrt(1)=1 unit.
 */
function arcWeight(degree: number): number {
  return Math.sqrt(Math.max(degree, 1));
}

/** Type order for visual grouping around the circle */
const TYPE_ORDER: ResourceType[] = ['document', 'script', 'stylesheet', 'image', 'font', 'media', 'other'];
function typeRank(t: ResourceType): number {
  const i = TYPE_ORDER.indexOf(t);
  return i === -1 ? TYPE_ORDER.length : i;
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  script:     '#F7DF1E',  // JS Yellow
  stylesheet: '#BB86FC',  // CSS Purple
  image:      '#03DAC6',  // Teal-Green
  other:      '#7C4DFF',  // XHR/fetch Indigo
  font:       '#06B6D4',  // Cyan
  document:   '#EF4444',  // Red
  media:      '#F97316',  // Orange
};

const TYPE_LABELS: Record<ResourceType, string> = {
  script:     'JS',
  stylesheet: 'CSS',
  image:      'Image',
  font:       'Font',
  document:   'Document',
  media:      'Media',
  other:      'Other',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(url: string, maxLen = 15): string {
  if (url === ROOT_URL) return 'Root';
  try {
    const u    = new URL(url);
    const file = u.pathname.split('/').pop()?.replace(/\?.*$/, '') ?? '';
    const lbl  = file || u.hostname;
    return lbl.length > maxLen ? lbl.slice(0, maxLen - 1) + '…' : lbl;
  } catch {
    const raw = url.split('/').pop()?.replace(/\?.*$/, '') ?? url;
    return raw.length > maxLen ? raw.slice(0, maxLen - 1) + '…' : raw;
  }
}

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  if (b >= 1024)        return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

/**
 * BFS from in-degree-0 nodes to assign chain depth to each URL.
 * Depth 0 = directly loaded by the page (Root children).
 * Depth 1 = loaded by a depth-0 resource, etc.
 */
function computeChainDepths(
  urls: string[],
  links: Array<{ source: string; target: string }>,
): Map<string, number> {
  const urlSet   = new Set(urls);
  const outEdges = new Map<string, string[]>();
  const inDeg    = new Map<string, number>();

  for (const u of urls) { outEdges.set(u, []); inDeg.set(u, 0); }

  for (const lk of links) {
    if (!urlSet.has(lk.source) || !urlSet.has(lk.target)) continue;
    outEdges.get(lk.source)!.push(lk.target);
    inDeg.set(lk.target, (inDeg.get(lk.target) ?? 0) + 1);
  }

  const depths = new Map<string, number>();
  const queue: string[] = [];

  for (const u of urls) {
    if ((inDeg.get(u) ?? 0) === 0) { depths.set(u, 0); queue.push(u); }
  }

  while (queue.length > 0) {
    const u = queue.shift()!;
    const d = depths.get(u) ?? 0;
    for (const nb of outEdges.get(u) ?? []) {
      // Always propagate maximum depth (handles diamond-shaped graphs)
      if ((depths.get(nb) ?? -1) < d + 1) {
        depths.set(nb, d + 1);
        queue.push(nb);
      }
    }
  }
  return depths;
}

/**
 * Color for a node: base type color brightened by chain depth.
 * Depth 0–1: base color.
 * Depth 2+: progressively brighter — highlights deep dependency chains.
 */
function nodeColor(nd: DependencyNode, depth: number, maxDepth: number): string {
  const base = RESOURCE_COLORS[nd.resourceType];
  if (nd.url === ROOT_URL || depth <= 1 || maxDepth <= 1) return base;
  const t   = (depth - 1) / Math.max(maxDepth - 1, 1); // 0 → 1
  const col = d3.color(base);
  if (!col) return base;
  return (col.brighter(t * 1.4) as d3.RGBColor).formatHex();
}

// ─── Internal types ───────────────────────────────────────────────────────────

type ArcDatum     = { start: number; end: number; mid: number; idx: number };
type RibbonInput  = {
  source: { startAngle: number; endAngle: number };
  target: { startAngle: number; endAngle: number };
  si: number; ti: number;
  link: DependencyGraph['links'][0];
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  graph: DependencyGraph;
  onResourceHover?: (url: string) => void;
}

export const ChordDiagram = memo(function ChordDiagram({ graph, onResourceHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);
  const [hoveredUrl, setHoveredUrl] = useState('');

  // ── Build enriched node/link lists ────────────────────────────────────────

  const { nodes, links, depths, maxDepth } = useMemo(() => {
    // 1. Deduplicate nodes
    const nodeMap = new Map<string, DependencyNode>(graph.nodes.map(n => [n.url, n]));

    for (const lk of graph.links) {
      for (const url of [lk.source, lk.target]) {
        if (!nodeMap.has(url)) {
          nodeMap.set(url, { url, label: shortLabel(url), resourceType: 'other', transferSize: 0 });
        }
      }
    }

    // 2. Build active links (no size filter — all resources included)
    let activeLinks = graph.links.filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));

    // 3. Inject Root node → connect all no-parent nodes to it
    const targetUrls = new Set(activeLinks.map(l => l.target));
    const noParent   = Array.from(nodeMap.keys()).filter(u => !targetUrls.has(u));
    if (noParent.length > 0) {
      nodeMap.set(ROOT_URL, {
        url:          ROOT_URL,
        label:        'Root',
        resourceType: 'document',
        transferSize: 0,
      });
      for (const url of noParent) {
        if (url !== ROOT_URL) {
          activeLinks.push({ source: ROOT_URL, target: url, transferSize: 0 });
        }
      }
    }

    // 4. Remove true orphans (no link at all — shouldn't happen after Root injection)
    const linkedUrls = new Set<string>();
    for (const lk of activeLinks) { linkedUrls.add(lk.source); linkedUrls.add(lk.target); }
    for (const url of nodeMap.keys()) {
      if (!linkedUrls.has(url)) nodeMap.delete(url);
    }

    // 5. Cap at NODE_LIMIT (Root always kept; rest sorted by transferSize)
    let nodes = Array.from(nodeMap.values());
    if (nodes.length > NODE_LIMIT) {
      const root    = nodes.find(n => n.url === ROOT_URL);
      const slots   = NODE_LIMIT - (root ? 1 : 0);
      const rest    = nodes
        .filter(n => n.url !== ROOT_URL)
        .sort((a, b) => b.transferSize - a.transferSize)
        .slice(0, slots);
      nodes         = root ? [root, ...rest] : rest;
      const keptSet = new Set(nodes.map(n => n.url));
      activeLinks   = activeLinks.filter(l => keptSet.has(l.source) && keptSet.has(l.target));
    }

    // 6. Group by type for visual clustering (Root first, then by TYPE_ORDER, then size)
    nodes.sort((a, b) => {
      if (a.url === ROOT_URL) return -1;
      if (b.url === ROOT_URL) return  1;
      const td = typeRank(a.resourceType) - typeRank(b.resourceType);
      return td !== 0 ? td : b.transferSize - a.transferSize;
    });

    // 7. Compute BFS chain depths for brightness coloring
    const depths   = computeChainDepths(nodes.map(n => n.url), activeLinks);
    const maxDepth = Math.max(0, ...depths.values());

    return { nodes, links: activeLinks, depths, maxDepth };
  }, [graph]);

  const handleHover = useCallback((url: string) => {
    setHoveredUrl(url);
    onResourceHover?.(url);
  }, [onResourceHover]);

  // ── D3 render ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const svgEl     = svgRef.current;
    const tooltip   = tooltipRef.current;
    if (!container || !svgEl || !tooltip || nodes.length === 0) return;

    const W      = container.clientWidth || 700;
    const H      = Math.max(W, 520);
    const cx     = W / 2;
    const cy     = H / 2;
    const outerR = Math.min(cx, cy) - 120;
    const innerR = outerR - 22;
    const n      = nodes.length;

    const urlIndex = new Map<string, number>(nodes.map((nd, i) => [nd.url, i]));

    // ── Degree-weighted arc layout ───────────────────────────────────────────
    const degree = new Array(n).fill(0);
    for (const lk of links) {
      const si = urlIndex.get(lk.source);
      const ti = urlIndex.get(lk.target);
      if (si != null) degree[si]++;
      if (ti != null) degree[ti]++;
    }

    const weights     = degree.map(d => arcWeight(d));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const available   = 2 * Math.PI - n * PAD_ANGLE;

    const arcData: ArcDatum[] = [];
    let cursor = 0;
    for (let i = 0; i < n; i++) {
      const span = (weights[i] / totalWeight) * available;
      arcData.push({ start: cursor, end: cursor + span, mid: cursor + span / 2, idx: i });
      cursor += span + PAD_ANGLE;
    }

    // ── Build ribbon data ────────────────────────────────────────────────────
    const outByNode = new Map<number, Array<DependencyGraph['links'][0]>>();
    const inByNode  = new Map<number, Array<DependencyGraph['links'][0]>>();
    for (const lk of links) {
      const si = urlIndex.get(lk.source);
      const ti = urlIndex.get(lk.target);
      if (si == null || ti == null) continue;
      if (!outByNode.has(si)) outByNode.set(si, []);
      if (!inByNode.has(ti))  inByNode.set(ti,  []);
      outByNode.get(si)!.push(lk);
      inByNode.get(ti)!.push(lk);
    }

    const RIBBON_HALF = 0.010;

    function spreadOffset(k: number, total: number, span: number): number {
      if (total <= 1) return 0;
      const range = Math.min(span * 0.6, total * RIBBON_HALF * 2.5);
      return -range / 2 + (k / (total - 1)) * range;
    }

    const ribbonData: RibbonInput[] = [];
    for (const lk of links) {
      const si = urlIndex.get(lk.source);
      const ti = urlIndex.get(lk.target);
      if (si == null || ti == null) continue;
      const srcList = outByNode.get(si)!;
      const tgtList = inByNode.get(ti)!;
      const arcSi   = arcData[si];
      const arcTi   = arcData[ti];
      const srcSpan = arcSi.end - arcSi.start;
      const tgtSpan = arcTi.end - arcTi.start;
      const srcMid  = arcSi.mid + spreadOffset(srcList.indexOf(lk), srcList.length, srcSpan);
      const tgtMid  = arcTi.mid + spreadOffset(tgtList.indexOf(lk), tgtList.length, tgtSpan);
      ribbonData.push({
        source: { startAngle: srcMid - RIBBON_HALF, endAngle: srcMid + RIBBON_HALF },
        target: { startAngle: tgtMid - RIBBON_HALF, endAngle: tgtMid + RIBBON_HALF },
        si, ti, link: lk,
      });
    }

    // ── SVG setup ────────────────────────────────────────────────────────────
    const svg = d3.select(svgEl).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // ── Draw ribbons first (behind arcs) ─────────────────────────────────────
    const ribbonPath = d3.ribbon<RibbonInput, { startAngle: number; endAngle: number }>()
      .radius(innerR - 1);

    g.append('g').attr('class', 'ribbons')
      .selectAll<SVGPathElement, RibbonInput>('path.ribbon')
      .data(ribbonData).enter().append('path')
      .attr('class', 'ribbon')
      .attr('d', ribbonPath)
      .attr('fill',         d => nodeColor(nodes[d.si]!, depths.get(nodes[d.si]!.url) ?? 0, maxDepth))
      .attr('stroke',       d => nodeColor(nodes[d.si]!, depths.get(nodes[d.si]!.url) ?? 0, maxDepth))
      .attr('stroke-width', 0.4)
      .attr('opacity',      0.6)
      .style('cursor', 'pointer')
      .on('mouseenter', (_evt, d) => {
        const src = nodes[d.si]; const tgt = nodes[d.ti];
        if (!src || !tgt) return;
        tooltip.style.display = 'block';
        tooltip.innerHTML = buildRibbonTooltip(src, tgt, d.link, depths);
        handleHover(tgt.url);
      })
      .on('mousemove',  (evt: MouseEvent) => positionTooltip(tooltip, evt))
      .on('mouseleave', () => { tooltip.style.display = 'none'; handleHover(''); });

    // ── Draw arcs (on top of ribbons) ────────────────────────────────────────
    const arcGen = d3.arc<ArcDatum>()
      .innerRadius(innerR).outerRadius(outerR)
      .startAngle(d => d.start).endAngle(d => d.end);

    g.append('g').attr('class', 'arcs')
      .selectAll<SVGPathElement, ArcDatum>('path.arc-seg')
      .data(arcData).enter().append('path')
      .attr('class', 'arc-seg')
      .attr('d', arcGen)
      .attr('fill',         d => nodeColor(nodes[d.idx]!, depths.get(nodes[d.idx]!.url) ?? 0, maxDepth))
      .attr('stroke',       '#0f172a')
      .attr('stroke-width', 1)
      .attr('opacity',      0.9)
      .style('cursor', 'pointer')
      .on('mouseenter', (_evt, d) => {
        const node = nodes[d.idx];
        if (!node) return;
        tooltip.style.display = 'block';
        tooltip.innerHTML = buildArcTooltip(node, links, nodes, depths);
        handleHover(node.url);
      })
      .on('mousemove',  (evt: MouseEvent) => positionTooltip(tooltip, evt))
      .on('mouseleave', () => { tooltip.style.display = 'none'; handleHover(''); });

    // ── Radial labels ────────────────────────────────────────────────────────
    const labelR = outerR + 12;

    g.append('g').attr('class', 'labels')
      .selectAll<SVGTextElement, ArcDatum>('text.arc-label')
      .data(arcData).enter().append('text')
      .attr('class', 'arc-label')
      .attr('dy', '0.35em')
      .attr('transform', d => {
        const mid    = d.mid;
        const isLeft = mid > Math.PI;
        const deg    = (mid * 180) / Math.PI - 90;
        const x      = Math.sin(mid) * labelR;
        const y      = -Math.cos(mid) * labelR;
        return `translate(${x},${y}) rotate(${isLeft ? deg + 180 : deg})`;
      })
      .attr('text-anchor',    d => (d.mid > Math.PI ? 'end' : 'start'))
      .attr('fill',           d => nodeColor(nodes[d.idx]!, depths.get(nodes[d.idx]!.url) ?? 0, maxDepth))
      .attr('font-size',      10)
      .attr('font-weight',    d => (nodes[d.idx]?.url === ROOT_URL ? 700 : 400))
      .attr('font-family',    'ui-monospace, monospace')
      .attr('pointer-events', 'none')
      .text(d => shortLabel(nodes[d.idx]?.url ?? ''));

    // ── Center stats ─────────────────────────────────────────────────────────
    const depCount = nodes.filter(n => n.url !== ROOT_URL).length;
    g.append('text').attr('class', 'center-title')
      .attr('text-anchor', 'middle').attr('dy', '-0.4em')
      .attr('fill', '#94a3b8').attr('font-size', 11).attr('font-weight', 500)
      .text(`${depCount} resources with dependencies`);
    g.append('text').attr('class', 'center-sub')
      .attr('text-anchor', 'middle').attr('dy', '0.9em')
      .attr('fill', '#64748b').attr('font-size', 10)
      .text(`${links.length} links`);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, depths, maxDepth]);

  // ── Imperative hover (no React re-render) ─────────────────────────────────

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const depCount = nodes.filter(n => n.url !== ROOT_URL).length;

    d3.select(svgEl)
      .selectAll<SVGPathElement, ArcDatum>('path.arc-seg')
      .attr('opacity', function(d) {
        if (!hoveredUrl) return 0.9;
        return (nodes[d.idx]?.url ?? '') === hoveredUrl ? 1 : 0.12;
      });

    d3.select(svgEl)
      .selectAll<SVGPathElement, RibbonInput>('path.ribbon')
      .attr('opacity', function(d) {
        if (!hoveredUrl) return 0.6;
        const src = nodes[d.si]?.url ?? '';
        const tgt = nodes[d.ti]?.url ?? '';
        return src === hoveredUrl || tgt === hoveredUrl ? 1.0 : 0.1;
      });

    d3.select(svgEl)
      .selectAll<SVGTextElement, ArcDatum>('text.arc-label')
      .attr('opacity', function(d) {
        if (!hoveredUrl) return 1;
        return (nodes[d.idx]?.url ?? '') === hoveredUrl ? 1 : 0.2;
      });

    // Center text
    const svgSel  = d3.select(svgEl);
    const titleEl = svgSel.select<SVGTextElement>('text.center-title');
    const subEl   = svgSel.select<SVGTextElement>('text.center-sub');

    if (!hoveredUrl) {
      titleEl.text(`${depCount} resources with dependencies`).attr('fill', '#94a3b8');
      subEl.text(`${links.length} links`).attr('fill', '#64748b');
    } else {
      const node = nodes.find(n => n.url === hoveredUrl);
      if (node) {
        const depth = depths.get(node.url) ?? 0;
        const color = nodeColor(node, depth, maxDepth);
        titleEl.text(shortLabel(node.url)).attr('fill', color);
        subEl.text(
          node.url === ROOT_URL
            ? 'HTML Page'
            : `${TYPE_LABELS[node.resourceType]} · depth ${depth}`
        ).attr('fill', color);
      }
    }
  }, [hoveredUrl, nodes, links, depths, maxDepth]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const presentTypes = Array.from(
    new Set(nodes.filter(n => n.url !== ROOT_URL).map(n => n.resourceType))
  ) as ResourceType[];

  return (
    <div>
      {nodes.length >= NODE_LIMIT && (
        <p className="text-[10px] text-amber-500/80 mb-1 px-1">
          Showing top {NODE_LIMIT} resources by transfer size.
        </p>
      )}

      <div ref={containerRef} className="relative w-full select-none">
        <svg ref={svgRef} className="block w-full" />

        <div
          ref={tooltipRef}
          className="pointer-events-none fixed z-[200] hidden rounded-lg border border-slate-600 bg-slate-800/95 px-3 py-2 text-[11px] text-slate-200 shadow-xl backdrop-blur-sm"
          style={{ maxWidth: 280 }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pt-2 pb-1 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border border-red-400/60" />
          <span className="text-[10px] text-slate-500">Root</span>
        </div>
        {presentTypes.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: RESOURCE_COLORS[type] }} />
            <span className="text-[10px] text-slate-500">{TYPE_LABELS[type]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-white/20" />
          <span className="text-[10px] text-slate-500">brighter = deeper chain</span>
        </div>
        <span className="ml-auto text-[10px] text-slate-600">Hover arc or ribbon to trace chain</span>
      </div>
    </div>
  );
});

// ─── Tooltip builders ─────────────────────────────────────────────────────────

function buildArcTooltip(
  node: DependencyNode,
  links: DependencyGraph['links'],
  nodes: DependencyNode[],
  depths: Map<string, number>,
): string {
  const depth    = depths.get(node.url) ?? 0;
  const loadedBy = links
    .filter(l => l.target === node.url && l.source !== ROOT_URL)
    .map(l => nodes.find(n => n.url === l.source)?.label ?? shortLabel(l.source));
  const loads = links
    .filter(l => l.source === node.url)
    .map(l => nodes.find(n => n.url === l.target)?.label ?? shortLabel(l.target));
  const sizeStr   = node.transferSize > 0 ? fmtBytes(node.transferSize) : '';
  const typeColor = RESOURCE_COLORS[node.resourceType];

  const title = node.url === ROOT_URL ? 'Root (HTML Page)' : node.label;
  const sub   = node.url === ROOT_URL
    ? `Directly loads ${loads.length} resource${loads.length !== 1 ? 's' : ''}`
    : shortLabel(node.url, 50);

  return `
    <div style="font-weight:600;margin-bottom:2px">${title}</div>
    <div style="opacity:0.55;font-size:10px;margin-bottom:4px;word-break:break-all">${sub}</div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
      <span style="background:${typeColor};border-radius:3px;padding:1px 5px;font-size:10px;
                   font-weight:700;color:#0f172a">${TYPE_LABELS[node.resourceType]}</span>
      ${sizeStr ? `<span style="opacity:0.8">${sizeStr}</span>` : ''}
      ${depth > 0 ? `<span style="opacity:0.65;font-size:10px">chain depth ${depth}</span>` : ''}
    </div>
    ${loadedBy.length > 0 ? `
      <div style="opacity:0.65;font-size:10px">
        Loaded by: ${loadedBy.slice(0, 3).join(', ')}${loadedBy.length > 3 ? ` +${loadedBy.length - 3}` : ''}
      </div>` : ''}
    ${loads.length > 0 ? `
      <div style="opacity:0.65;font-size:10px">
        Loads: ${loads.slice(0, 3).join(', ')}${loads.length > 3 ? ` +${loads.length - 3}` : ''}
      </div>` : ''}
  `;
}

function buildRibbonTooltip(
  src: DependencyNode,
  tgt: DependencyNode,
  link: DependencyGraph['links'][0],
  depths: Map<string, number>,
): string {
  const tgtDepth = depths.get(tgt.url) ?? 0;
  return `
    <div style="font-weight:600;margin-bottom:4px">Dependency</div>
    <div style="margin-bottom:2px">
      <span style="opacity:0.55;font-size:10px">initiator </span>
      <span style="font-weight:500">${src.url === ROOT_URL ? 'Root (HTML)' : src.label}</span>
    </div>
    <div style="margin-bottom:4px">
      <span style="opacity:0.55;font-size:10px">loads </span>
      <span style="font-weight:500">${tgt.label}</span>
    </div>
    <div style="display:flex;gap:8px;opacity:0.7;font-size:10px">
      ${link.transferSize > 0 ? `<span>${fmtBytes(link.transferSize)}</span>` : ''}
      ${tgtDepth > 0 ? `<span>chain depth: ${tgtDepth}</span>` : ''}
    </div>
  `;
}

function positionTooltip(tooltip: HTMLDivElement, evt: MouseEvent): void {
  tooltip.style.left = `${Math.min(evt.clientX + 14, window.innerWidth - 290)}px`;
  tooltip.style.top  = `${evt.clientY - 8}px`;
}
