/**
 * HeapMemoryChart — D3 area chart visualizing JS heap memory over time.
 *
 * • Smooth area + line from Chrome trace UpdateCounters events
 * • Green GC markers where heap drops sharply (≥ 2 MB, ≥ 10 %)
 * • Interactive crosshair tooltip
 * • Summary cards: Average Heap, Peak Heap
 */

import { useEffect, useRef, memo } from 'react';
import * as d3 from 'd3';
import { MemoryStick, TrendingUp } from 'lucide-react';
import type { HeapMemoryData, HeapMemoryPoint } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN = { top: 16, right: 24, bottom: 36, left: 52 };
const CHART_H = 180; // inner chart height (px)
const GC_R    = 5;   // GC marker circle radius

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMb(mb: number): string {
  return mb >= 100 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: HeapMemoryData;
}

export const HeapMemoryChart = memo(function HeapMemoryChart({ data }: Props) {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // ── D3 render ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    const tip   = tooltipRef.current;
    if (!wrap || !svgEl || !tip || data.points.length === 0) return;

    const totalW  = wrap.clientWidth;
    const innerW  = totalW - MARGIN.left - MARGIN.right;
    const innerH  = CHART_H;
    const totalH  = innerH + MARGIN.top + MARGIN.bottom;

    // ── Scales ────────────────────────────────────────────────────────────────

    const xDomain = d3.extent(data.points, p => p.timeMs) as [number, number];
    const yMax    = data.peakMb * 1.12; // 12 % headroom above peak

    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

    // ── SVG setup ─────────────────────────────────────────────────────────────

    const svg = d3.select(svgEl)
      .attr('width',  totalW)
      .attr('height', totalH);

    svg.selectAll('*').remove();

    // Gradient definition
    const gradId = 'hm-area-grad';
    const defs   = svg.append('defs');
    const grad   = defs.append('linearGradient')
      .attr('id', gradId)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', MARGIN.top)
      .attr('x2', 0).attr('y2', MARGIN.top + innerH);

    grad.append('stop').attr('offset', '0%')
      .attr('stop-color', '#6366f1').attr('stop-opacity', 0.35);
    grad.append('stop').attr('offset', '100%')
      .attr('stop-color', '#6366f1').attr('stop-opacity', 0.02);

    // Clip path
    const clipId = 'hm-clip';
    defs.append('clipPath').attr('id', clipId)
      .append('rect').attr('width', innerW).attr('height', innerH);

    // Main group shifted by margins
    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // ── Grid lines ────────────────────────────────────────────────────────────

    const yTicks = yScale.ticks(5);
    g.append('g').attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
      .attr('stroke', '#334155').attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    // ── Area path ─────────────────────────────────────────────────────────────

    const areaGen = d3.area<HeapMemoryPoint>()
      .x(p => xScale(p.timeMs))
      .y0(innerH)
      .y1(p => yScale(p.heapMb))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append('path')
      .datum(data.points)
      .attr('clip-path', `url(#${clipId})`)
      .attr('fill', `url(#${gradId})`)
      .attr('d', areaGen);

    // ── Line path ─────────────────────────────────────────────────────────────

    const lineGen = d3.line<HeapMemoryPoint>()
      .x(p => xScale(p.timeMs))
      .y(p => yScale(p.heapMb))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append('path')
      .datum(data.points)
      .attr('clip-path', `url(#${clipId})`)
      .attr('fill', 'none')
      .attr('stroke', '#818cf8')
      .attr('stroke-width', 1.5)
      .attr('d', lineGen);

    // ── Average line ──────────────────────────────────────────────────────────

    const avgY = yScale(data.averageMb);
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', avgY).attr('y2', avgY)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0.7);

    g.append('text')
      .attr('x', innerW - 2).attr('y', avgY - 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 9)
      .attr('fill', '#f59e0b')
      .attr('opacity', 0.8)
      .text('avg');

    // ── GC markers ────────────────────────────────────────────────────────────

    const gcPoints = data.points.filter(p => p.isGC);

    const gcGroup = g.append('g').attr('clip-path', `url(#${clipId})`);

    // Outer glow ring
    gcGroup.selectAll<SVGCircleElement, HeapMemoryPoint>('circle.gc-glow')
      .data(gcPoints)
      .enter()
      .append('circle')
      .attr('class', 'gc-glow')
      .attr('cx', p => xScale(p.timeMs))
      .attr('cy', p => yScale(p.heapMb))
      .attr('r', GC_R + 3)
      .attr('fill', '#22c55e')
      .attr('opacity', 0.18);

    // Inner circle
    gcGroup.selectAll<SVGCircleElement, HeapMemoryPoint>('circle.gc-dot')
      .data(gcPoints)
      .enter()
      .append('circle')
      .attr('class', 'gc-dot')
      .attr('cx', p => xScale(p.timeMs))
      .attr('cy', p => yScale(p.heapMb))
      .attr('r', GC_R)
      .attr('fill', '#22c55e')
      .attr('stroke', '#15803d')
      .attr('stroke-width', 1)
      .attr('opacity', 0.92);

    // "GC" label above the dot
    gcGroup.selectAll<SVGTextElement, HeapMemoryPoint>('text.gc-label')
      .data(gcPoints)
      .enter()
      .append('text')
      .attr('class', 'gc-label')
      .attr('x', p => xScale(p.timeMs))
      .attr('y', p => yScale(p.heapMb) - GC_R - 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('font-weight', '700')
      .attr('fill', '#4ade80')
      .text('GC');

    // ── X axis ────────────────────────────────────────────────────────────────

    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat(d => fmtMs(d as number));

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call(ax => {
        ax.select('.domain').attr('stroke', '#334155');
        ax.selectAll('.tick line').attr('stroke', '#475569');
        ax.selectAll('.tick text')
          .attr('fill', '#94a3b8')
          .attr('font-size', 10);
      });

    // ── Y axis ────────────────────────────────────────────────────────────────

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${(d as number).toFixed(0)} MB`);

    g.append('g')
      .call(yAxis)
      .call(ax => {
        ax.select('.domain').attr('stroke', '#334155');
        ax.selectAll('.tick line').attr('stroke', '#475569');
        ax.selectAll('.tick text')
          .attr('fill', '#94a3b8')
          .attr('font-size', 10);
      });

    // ── Interactive crosshair + tooltip ───────────────────────────────────────

    const bisect = d3.bisector<HeapMemoryPoint, number>(p => p.timeMs).left;

    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 1)
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    const hoverDot = g.append('circle')
      .attr('r', 4)
      .attr('fill', '#818cf8')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .attr('pointer-events', 'none');

    // Invisible overlay to capture mouse events
    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', (evt: MouseEvent) => {
        const [mx] = d3.pointer(evt);
        const timeMs = xScale.invert(mx);
        const idx    = bisect(data.points, timeMs, 1);
        const a      = data.points[idx - 1];
        const b      = data.points[idx];
        if (!a) return;

        const pt = b && Math.abs(b.timeMs - timeMs) < Math.abs(a.timeMs - timeMs) ? b : a;

        const cx = xScale(pt.timeMs);
        const cy = yScale(pt.heapMb);

        crosshair.attr('x1', cx).attr('x2', cx).attr('opacity', 0.6);
        hoverDot.attr('cx', cx).attr('cy', cy).attr('opacity', 1);

        const tx = Math.min(evt.clientX + 14, window.innerWidth - 200);
        const ty = evt.clientY - 8;
        tip.style.display = 'block';
        tip.style.left    = `${tx}px`;
        tip.style.top     = `${ty}px`;
        tip.innerHTML     = `
          <div style="font-weight:600;margin-bottom:2px">${fmtMb(pt.heapMb)}</div>
          <div style="opacity:0.7;font-size:10px">@ ${fmtMs(pt.timeMs)}</div>
          ${pt.isGC ? '<div style="color:#4ade80;font-size:10px;margin-top:2px">⬤ GC event</div>' : ''}
        `;
      })
      .on('mouseleave', () => {
        crosshair.attr('opacity', 0);
        hoverDot.attr('opacity', 0);
        tip.style.display = 'none';
      });

    return () => { tip.style.display = 'none'; };
  }, [data]);

  const gcCount = data.points.filter(p => p.isGC).length;

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className="relative select-none">
      {/* Chart */}
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />

      {/* Fixed tooltip */}
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[200] hidden rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-[11px] text-slate-200 shadow-xl"
        style={{ maxWidth: 180 }}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mt-3 px-1">
        {/* Average Heap */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 flex items-start gap-2.5">
          <MemoryStick className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-tight">Average Heap</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">{fmtMb(data.averageMb)}</p>
          </div>
        </div>

        {/* Peak Heap */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 flex items-start gap-2.5">
          <TrendingUp className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-tight">Peak Heap</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">{fmtMb(data.peakMb)}</p>
          </div>
        </div>

        {/* GC Events */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 flex items-start gap-2.5">
          <span className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
            <span className="block w-2.5 h-2.5 rounded-full bg-green-500" />
          </span>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-tight">GC Events</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">
              {gcCount > 0 ? gcCount : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-5 px-1 pt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-indigo-400 rounded" />
          <span className="text-[10px] text-slate-500">JS Heap Used</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0" style={{ borderTop: '1px dashed #f59e0b' }} />
          <span className="text-[10px] text-slate-500">Average</span>
        </div>
        {gcCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-slate-500">GC Event</span>
          </div>
        )}
      </div>
    </div>
  );
});
