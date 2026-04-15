import { useEffect, useRef, memo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { DependencyGraph, DependencyNode, ResourceType } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_LIMIT          = 50;
const MIN_TRANSFER_BYTES  = 10 * 1024;  // hide resources < 10 KB
const PAD_ANGLE           = 0.04;       // fixed gap between arcs (radians)

/**
 * Fixed angular half-width for each ribbon endpoint.
 * All ribbons have the same visual weight — no single link dominates.
 */
const RIBBON_HALF = 0.010; // ~0.57° per side

const RESOURCE_COLORS: Record<ResourceType, string> = {
  script:     '#F7DF1E',  // JS Yellow  (spec)
  stylesheet: '#BB86FC',  // CSS Purple (spec)
  image:      '#03DAC6',  // Teal-Green (spec)
  other:      '#7C4DFF',  // XHR/fetch — lightened from #3700B3 for legibility on dark bg
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

// ─── Internal types ───────────────────────────────────────────────────────────

type ArcDatum = { start: number; end: number; mid: number; idx: number };

type RibbonInput = {
  /** source/target shape expected by d3.ribbon() default accessors */
  source: { startAngle: number; endAngle: number };
  target: { startAngle: number; endAngle: number };
  si: number;
  ti: number;
  link: DependencyGraph['links'][0];
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  graph: DependencyGraph;
  /** Fired on hover with URL; empty string = clear hover */
  onResourceHover?: (url: string) => void;
}

export const ChordDiagram = memo(function ChordDiagram({ graph, onResourceHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);
  const [hoveredUrl, setHoveredUrl] = useState('');

  // ── Derive filtered node / link lists ─────────────────────────────────────

  const { nodes, links, filteredCount } = (() => {
    // 1. Deduplicate nodes by URL
    const nodeMap = new Map<string, DependencyNode>(graph.nodes.map(n => [n.url, n]));

    // Ensure every URL referenced in links has a node entry
    for (const lk of graph.links) {
      for (const url of [lk.source, lk.target]) {
        if (!nodeMap.has(url)) {
          nodeMap.set(url, { url, label: shortLabel(url), resourceType: 'other', transferSize: 0 });
        }
      }
    }

    // 2. Drop resources below the min-size threshold.
    //    Keep transferSize === 0 (initiator docs) so the graph stays connected.
    const before = nodeMap.size;
    for (const [url, node] of nodeMap) {
      if (node.transferSize > 0 && node.transferSize < MIN_TRANSFER_BYTES) nodeMap.delete(url);
    }
    const filteredCount = before - nodeMap.size;

    // 3. Filter links to surviving nodes
    let activeLinks = graph.links.filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));
    let nodes = Array.from(nodeMap.values());

    // 4. Hard cap at NODE_LIMIT
    if (nodes.length > NODE_LIMIT) {
      const kept    = [...nodes].sort((a, b) => b.transferSize - a.transferSize).slice(0, NODE_LIMIT);
      const keptSet = new Set(kept.map(n => n.url));
      nodes       = kept;
      activeLinks = activeLinks.filter(l => keptSet.has(l.source) && keptSet.has(l.target));
    }

    return { nodes, links: activeLinks, filteredCount };
  })();

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

    const W  = container.clientWidth || 700;
    const H  = Math.max(W, 520);
    const cx = W / 2;
    const cy = H / 2;
    // Leave enough room for labels (longest label ≈ 26 chars × ~6px + arc gap)
    const outerR = Math.min(cx, cy) - 120;
    const innerR = outerR - 20;
    const n      = nodes.length;

    // ── Equal arc layout ────────────────────────────────────────────────────
    // Every node occupies exactly the same angular span.
    // Size differences are irrelevant to arc width.
    const arcSpan  = (2 * Math.PI - n * PAD_ANGLE) / n;
    const arcData: ArcDatum[] = nodes.map((_, i) => {
      const start = i * (arcSpan + PAD_ANGLE);
      return { start, end: start + arcSpan, mid: start + arcSpan / 2, idx: i };
    });

    const urlIndex = new Map<string, number>(nodes.map((nd, i) => [nd.url, i]));

    const svg = d3.select(svgEl).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // ── Build ribbon data ────────────────────────────────────────────────────
    // Group links by source / target node so we can spread ribbon endpoints
    // evenly within the arc — no two ribbons overlap at the same angle.
    const outByNode = new Map<number, Array<DependencyGraph['links'][0]>>();
    const inByNode  = new Map<number, Array<DependencyGraph['links'][0]>>();
    for (const lk of links) {
      const si = urlIndex.get(lk.source);
      const ti = urlIndex.get(lk.target);
      if (si == null || ti == null) continue;
      if (!outByNode.has(si)) outByNode.set(si, []);
      if (!inByNode.has(ti))  inByNode.set(ti, []);
      outByNode.get(si)!.push(lk);
      inByNode.get(ti)!.push(lk);
    }

    /** Return the angular offset for the k-th link among total links on a node. */
    function spread(k: number, total: number): number {
      if (total <= 1) return 0;
      // Distribute across 60% of the arc span (max spread = 30% each side)
      const range = Math.min(arcSpan * 0.6, total * RIBBON_HALF * 2.5);
      return -range / 2 + (k / (total - 1)) * range;
    }

    const ribbonData: RibbonInput[] = [];
    for (const lk of links) {
      const si = urlIndex.get(lk.source);
      const ti = urlIndex.get(lk.target);
      if (si == null || ti == null) continue;

      const srcList = outByNode.get(si)!;
      const tgtList = inByNode.get(ti)!;
      const srcOff  = spread(srcList.indexOf(lk), srcList.length);
      const tgtOff  = spread(tgtList.indexOf(lk), tgtList.length);

      const srcMid = arcData[si].mid + srcOff;
      const tgtMid = arcData[ti].mid + tgtOff;

      ribbonData.push({
        source: { startAngle: srcMid - RIBBON_HALF, endAngle: srcMid + RIBBON_HALF },
        target: { startAngle: tgtMid - RIBBON_HALF, endAngle: tgtMid + RIBBON_HALF },
        si, ti, link: lk,
      });
    }

    // ── Draw arcs ────────────────────────────────────────────────────────────
    const arcGen = d3.arc<ArcDatum>()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .startAngle(d => d.start)
      .endAngle(d => d.end);

    g.append('g').attr('class', 'arcs')
      .selectAll<SVGPathElement, ArcDatum>('path.arc-seg')
      .data(arcData)
      .enter()
      .append('path')
      .attr('class', 'arc-seg')
      .attr('d', arcGen)
      .attr('fill',         d => RESOURCE_COLORS[nodes[d.idx]?.resourceType ?? 'other'])
      .attr('stroke',       '#0f172a')
      .attr('stroke-width', 1)
      .attr('opacity',      0.9)
      .style('cursor', 'pointer')
      .on('mouseenter', (_evt, d) => {
        const node = nodes[d.idx];
        if (!node) return;
        tooltip.style.display = 'block';
        tooltip.innerHTML = buildArcTooltip(node, links, nodes);
        handleHover(node.url);
      })
      .on('mousemove',  (evt: MouseEvent) => positionTooltip(tooltip, evt))
      .on('mouseleave', () => { tooltip.style.display = 'none'; handleHover(''); });

    // ── Draw ribbons ─────────────────────────────────────────────────────────
    // d3.ribbon() default accessors read .source and .target — our RibbonInput
    // matches that shape exactly, so no custom accessor needed.
    const ribbonPath = d3.ribbon<RibbonInput, { startAngle: number; endAngle: number }>()
      .radius(innerR - 1);

    g.append('g').attr('class', 'ribbons')
      .selectAll<SVGPathElement, RibbonInput>('path.ribbon')
      .data(ribbonData)
      .enter()
      .append('path')
      .attr('class', 'ribbon')
      .attr('d', ribbonPath)
      .attr('fill',         d => RESOURCE_COLORS[nodes[d.si]?.resourceType ?? 'other'])
      .attr('stroke',       d => RESOURCE_COLORS[nodes[d.si]?.resourceType ?? 'other'])
      .attr('stroke-width', 0.4)
      .attr('opacity',      0.6)
      .style('cursor', 'pointer')
      .on('mouseenter', (_evt, d) => {
        const src = nodes[d.si];
        const tgt = nodes[d.ti];
        if (!src || !tgt) return;
        tooltip.style.display = 'block';
        tooltip.innerHTML = buildRibbonTooltip(src, tgt, d.link);
        handleHover(tgt.url);
      })
      .on('mousemove',  (evt: MouseEvent) => positionTooltip(tooltip, evt))
      .on('mouseleave', () => { tooltip.style.display = 'none'; handleHover(''); });

    // ── Radial labels ────────────────────────────────────────────────────────
    // Standard D3 radial rotation:
    //   - rotate so text lies along the radius (tangent to the arc)
    //   - for arcs on the left half (mid > π), rotate 180° and use text-anchor:end
    //     so the text reads outward and never appears upside-down
    const labelR = outerR + 12;

    g.append('g').attr('class', 'labels')
      .selectAll<SVGTextElement, ArcDatum>('text.arc-label')
      .data(arcData)
      .enter()
      .append('text')
      .attr('class', 'arc-label')
      .attr('dy', '0.35em')
      .attr('transform', d => {
        const mid     = d.mid;
        const isLeft  = mid > Math.PI;
        const degrees = (mid * 180) / Math.PI - 90;
        const x       = Math.sin(mid) * labelR;
        const y       = -Math.cos(mid) * labelR;
        // Flip left-side labels 180° so they read outward left-to-right
        return `translate(${x},${y}) rotate(${isLeft ? degrees + 180 : degrees})`;
      })
      .attr('text-anchor', d => (d.mid > Math.PI ? 'end' : 'start'))
      .attr('fill',         d => RESOURCE_COLORS[nodes[d.idx]?.resourceType ?? 'other'])
      .attr('font-size',    10)
      .attr('font-family',  'ui-monospace, monospace')
      .attr('pointer-events', 'none')
      .text(d => shortLabel(nodes[d.idx]?.url ?? ''));

    // ── Center stats (updated imperatively on hover) ──────────────────────────
    g.append('text')
      .attr('class', 'center-title')
      .attr('text-anchor', 'middle').attr('dy', '-0.4em')
      .attr('fill', '#94a3b8').attr('font-size', 11).attr('font-weight', 500)
      .text(`${nodes.length} resources`);
    g.append('text')
      .attr('class', 'center-sub')
      .attr('text-anchor', 'middle').attr('dy', '0.9em')
      .attr('fill', '#64748b').attr('font-size', 10)
      .text(`${links.length} links`);

  // hoveredUrl intentionally omitted — opacity is applied imperatively below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links]);

  // ── Imperative hover — no React re-render ─────────────────────────────────

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

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
        const srcUrl = nodes[d.si]?.url ?? '';
        const tgtUrl = nodes[d.ti]?.url ?? '';
        return srcUrl === hoveredUrl || tgtUrl === hoveredUrl ? 1.0 : 0.1;
      });

    d3.select(svgEl)
      .selectAll<SVGTextElement, ArcDatum>('text.arc-label')
      .attr('opacity', function(d) {
        if (!hoveredUrl) return 1;
        return (nodes[d.idx]?.url ?? '') === hoveredUrl ? 1 : 0.2;
      });

    // ── Center text: show hovered resource info, or reset to totals ───────────
    const svgSel   = d3.select(svgEl);
    const titleEl  = svgSel.select<SVGTextElement>('text.center-title');
    const subEl    = svgSel.select<SVGTextElement>('text.center-sub');

    if (!hoveredUrl) {
      titleEl.text(`${nodes.length} resources`).attr('fill', '#94a3b8');
      subEl.text(`${links.length} links`).attr('fill', '#64748b');
    } else {
      const node = nodes.find(n => n.url === hoveredUrl);
      if (node) {
        const color = RESOURCE_COLORS[node.resourceType];
        titleEl.text(shortLabel(node.url)).attr('fill', color);
        subEl.text(TYPE_LABELS[node.resourceType]).attr('fill', color);
      }
    }
  }, [hoveredUrl, nodes, links]);

  // ── Render ────────────────────────────────────────────────────────────────

  const presentTypes  = Array.from(new Set(nodes.map(n => n.resourceType))) as ResourceType[];
  const isNodeLimited = nodes.length === NODE_LIMIT && graph.nodes.length > NODE_LIMIT;

  return (
    <div>
      {/* Filter notices */}
      {filteredCount > 0 && (
        <p className="text-[10px] text-slate-500 mb-1 px-1">
          {filteredCount} resources under 10 KB hidden.
          {isNodeLimited && ` Showing top ${NODE_LIMIT} of remaining.`}
        </p>
      )}
      {!filteredCount && isNodeLimited && (
        <p className="text-[10px] text-amber-500/80 mb-1 px-1">
          Showing top {NODE_LIMIT} resources by transfer size.
        </p>
      )}

      <div ref={containerRef} className="relative w-full select-none">
        <svg ref={svgRef} className="block w-full" />

        {/* Fixed-position tooltip */}
        <div
          ref={tooltipRef}
          className="pointer-events-none fixed z-[200] hidden rounded-lg border border-slate-600 bg-slate-800/95 px-3 py-2 text-[11px] text-slate-200 shadow-xl backdrop-blur-sm"
          style={{ maxWidth: 280 }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pt-2 pb-1 border-t border-slate-800/60">
        {presentTypes.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: RESOURCE_COLORS[type] }} />
            <span className="text-[10px] text-slate-500">{TYPE_LABELS[type]}</span>
          </div>
        ))}
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
): string {
  const loadedBy = links.filter(l => l.target === node.url)
    .map(l => nodes.find(n => n.url === l.source)?.label ?? shortLabel(l.source));
  const loads = links.filter(l => l.source === node.url)
    .map(l => nodes.find(n => n.url === l.target)?.label ?? shortLabel(l.target));
  const sizeStr   = node.transferSize > 0 ? fmtBytes(node.transferSize) : 'unknown size';
  const typeColor = RESOURCE_COLORS[node.resourceType];

  return `
    <div style="font-weight:600;margin-bottom:2px;word-break:break-all">${node.label}</div>
    <div style="opacity:0.55;font-size:10px;margin-bottom:4px;word-break:break-all"
         title="${node.url}">${shortLabel(node.url, 50)}</div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <span style="background:${typeColor};border-radius:3px;padding:1px 5px;font-size:10px;
                   font-weight:700;color:#0f172a">${TYPE_LABELS[node.resourceType]}</span>
      <span style="opacity:0.8">${sizeStr}</span>
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
): string {
  return `
    <div style="font-weight:600;margin-bottom:4px">Dependency</div>
    <div style="margin-bottom:2px">
      <span style="opacity:0.55;font-size:10px">initiator </span>
      <span style="font-weight:500">${src.label}</span>
    </div>
    <div style="margin-bottom:4px">
      <span style="opacity:0.55;font-size:10px">loads </span>
      <span style="font-weight:500">${tgt.label}</span>
    </div>
    <div style="opacity:0.7;font-size:10px">Transfer size: ${fmtBytes(link.transferSize)}</div>
  `;
}

function positionTooltip(tooltip: HTMLDivElement, evt: MouseEvent): void {
  tooltip.style.left = `${Math.min(evt.clientX + 14, window.innerWidth - 290)}px`;
  tooltip.style.top  = `${evt.clientY - 8}px`;
}
