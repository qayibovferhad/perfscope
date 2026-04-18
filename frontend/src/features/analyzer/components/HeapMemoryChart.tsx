/**
 * HeapMemoryChart — D3 area chart visualizing JS heap memory over time.
 *
 * • Smooth area + line from Chrome trace UpdateCounters events
 * • Green GC markers where heap drops sharply (≥ 2 MB, ≥ 10 %)
 * • Baseline line: minimum heap after GC events
 * • Trend analysis: "Potential Leak" badge when last 20% trends up
 * • Click-to-seek: syncs FlameChart ghost line via TimelineContext
 * • Tooltip: MB value + % change vs previous point
 */

import { useEffect, useRef, useMemo, memo } from 'react';
import * as d3 from 'd3';
import { MemoryStick, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTimelineContext } from '../context/TimelineContext';
import type { HeapMemoryData, HeapMemoryPoint } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN = { top: 16, right: 24, bottom: 36, left: 52 };
const CHART_H = 180;
const GC_R    = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMb(mb: number): string {
  return mb >= 100 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
}

function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: HeapMemoryData;
}

export const HeapMemoryChart = memo(function HeapMemoryChart({ data }: Props) {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const ctx        = useTimelineContext();

  // ── Pre-computed derived values ─────────────────────────────────────────────

  const gcBaseline = useMemo<number | null>(() => {
    const gcPts = data.points.filter(p => p.isGC);
    if (gcPts.length === 0) return null;
    return Math.min(...gcPts.map(p => p.heapMb));
  }, [data]);

  const hasPotentialLeak = useMemo<boolean>(() => {
    if (data.points.length < 5) return false;
    const times  = data.points.map(p => p.timeMs);
    const tMin   = times[0];
    const tMax   = times[times.length - 1];
    const cutoff = tMin + (tMax - tMin) * 0.8;
    const seg    = data.points.filter(p => p.timeMs >= cutoff);
    if (seg.length < 3) return false;
    let rising = 0;
    for (let i = 1; i < seg.length; i++) {
      if (seg[i].heapMb > seg[i - 1].heapMb) rising++;
    }
    return rising / (seg.length - 1) > 0.65;
  }, [data]);

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

    const xDomain = d3.extent(data.points, p => p.timeMs) as [number, number];
    const yMax    = data.peakMb * 1.12;

    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

    const svg = d3.select(svgEl)
      .attr('width',  totalW)
      .attr('height', totalH);

    svg.selectAll('*').remove();

    // Gradient
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

    const clipId = 'hm-clip';
    defs.append('clipPath').attr('id', clipId)
      .append('rect').attr('width', innerW).attr('height', innerH);

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid lines
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

    // Area path
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

    // Line path
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

    // Baseline line (min heap after GC events)
    if (gcBaseline !== null) {
      const baseY = yScale(gcBaseline);
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', baseY).attr('y2', baseY)
        .attr('stroke', '#22d3ee')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4 3')
        .attr('opacity', 0.7);

      g.append('text')
        .attr('x', innerW - 2).attr('y', baseY - 4)
        .attr('text-anchor', 'end')
        .attr('font-size', 9)
        .attr('fill', '#22d3ee')
        .attr('opacity', 0.85)
        .text('baseline');
    }

    // GC markers
    const gcPoints = data.points.filter(p => p.isGC);
    const gcGroup  = g.append('g').attr('clip-path', `url(#${clipId})`);

    gcGroup.selectAll<SVGCircleElement, HeapMemoryPoint>('circle.gc-glow')
      .data(gcPoints).enter()
      .append('circle').attr('class', 'gc-glow')
      .attr('cx', p => xScale(p.timeMs))
      .attr('cy', p => yScale(p.heapMb))
      .attr('r', GC_R + 3)
      .attr('fill', '#22c55e').attr('opacity', 0.18);

    gcGroup.selectAll<SVGCircleElement, HeapMemoryPoint>('circle.gc-dot')
      .data(gcPoints).enter()
      .append('circle').attr('class', 'gc-dot')
      .attr('cx', p => xScale(p.timeMs))
      .attr('cy', p => yScale(p.heapMb))
      .attr('r', GC_R)
      .attr('fill', '#22c55e')
      .attr('stroke', '#15803d').attr('stroke-width', 1)
      .attr('opacity', 0.92);

    gcGroup.selectAll<SVGTextElement, HeapMemoryPoint>('text.gc-label')
      .data(gcPoints).enter()
      .append('text').attr('class', 'gc-label')
      .attr('x', p => xScale(p.timeMs))
      .attr('y', p => yScale(p.heapMb) - GC_R - 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 7).attr('font-weight', '700')
      .attr('fill', '#4ade80')
      .text('GC');

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => fmtMs(d as number)))
      .call(ax => {
        ax.select('.domain').attr('stroke', '#334155');
        ax.selectAll('.tick line').attr('stroke', '#475569');
        ax.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', 10);
      });

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${(d as number).toFixed(0)} MB`))
      .call(ax => {
        ax.select('.domain').attr('stroke', '#334155');
        ax.selectAll('.tick line').attr('stroke', '#475569');
        ax.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', 10);
      });

    // Crosshair + hover dot
    const bisect = d3.bisector<HeapMemoryPoint, number>(p => p.timeMs).left;

    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#60a5fa').attr('stroke-width', 1)
      .attr('opacity', 0).attr('pointer-events', 'none');

    const hoverDot = g.append('circle')
      .attr('r', 4)
      .attr('fill', '#818cf8').attr('stroke', '#1e293b').attr('stroke-width', 2)
      .attr('opacity', 0).attr('pointer-events', 'none');

    // Invisible overlay — handles hover and click
    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (evt: MouseEvent) => {
        const [mx] = d3.pointer(evt);
        const timeMs = xScale.invert(mx);
        const idx    = bisect(data.points, timeMs, 1);
        const a      = data.points[idx - 1];
        const b      = data.points[idx];
        if (!a) return;

        const pt    = b && Math.abs(b.timeMs - timeMs) < Math.abs(a.timeMs - timeMs) ? b : a;
        const ptIdx = data.points.indexOf(pt);
        const prev  = ptIdx > 0 ? data.points[ptIdx - 1] : null;

        const cx = xScale(pt.timeMs);
        const cy = yScale(pt.heapMb);

        crosshair.attr('x1', cx).attr('x2', cx).attr('opacity', 0.6);
        hoverDot.attr('cx', cx).attr('cy', cy).attr('opacity', 1);

        let pctLine = '';
        if (prev) {
          const pct = ((pt.heapMb - prev.heapMb) / prev.heapMb) * 100;
          const color = pct >= 0 ? '#f87171' : '#4ade80';
          pctLine = `<div style="color:${color};font-size:10px;margin-top:1px">${fmtPct(pct)} vs prev</div>`;
        }

        const tx = Math.min(evt.clientX + 14, window.innerWidth - 200);
        const ty = evt.clientY - 8;
        tip.style.display = 'block';
        tip.style.left    = `${tx}px`;
        tip.style.top     = `${ty}px`;
        tip.innerHTML     = `
          <div style="font-weight:600;margin-bottom:2px">${fmtMb(pt.heapMb)}</div>
          <div style="opacity:0.7;font-size:10px">@ ${fmtMs(pt.timeMs)}</div>
          ${pctLine}
          ${pt.isGC ? '<div style="color:#4ade80;font-size:10px;margin-top:2px">⬤ GC event</div>' : ''}
        `;
      })
      .on('click', (evt: MouseEvent) => {
        if (!ctx) return;
        const [mx] = d3.pointer(evt);
        const timeMs = xScale.invert(mx);
        const idx    = bisect(data.points, timeMs, 1);
        const a      = data.points[idx - 1];
        const b      = data.points[idx];
        if (!a) return;
        const pt = b && Math.abs(b.timeMs - timeMs) < Math.abs(a.timeMs - timeMs) ? b : a;
        ctx.motionMs.set(pt.timeMs);
      })
      .on('mouseleave', () => {
        crosshair.attr('opacity', 0);
        hoverDot.attr('opacity', 0);
        tip.style.display = 'none';
      });

    return () => { tip.style.display = 'none'; };
  }, [data, gcBaseline, ctx]);

  const gcCount = data.points.filter(p => p.isGC).length;

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className="relative select-none">
      {/* Potential Leak badge */}
      {hasPotentialLeak && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-950/60 px-2.5 py-1 text-[11px] font-semibold text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Potential Leak
        </div>
      )}

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
        {/* Baseline */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 flex items-start gap-2.5">
          <MemoryStick className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide leading-tight">GC Baseline</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">
              {gcBaseline !== null ? fmtMb(gcBaseline) : '—'}
            </p>
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
        {gcBaseline !== null && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0" style={{ borderTop: '1px dashed #22d3ee' }} />
            <span className="text-[10px] text-slate-500">GC Baseline</span>
          </div>
        )}
        {gcCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-slate-500">GC Event</span>
          </div>
        )}
        <span className="ml-auto text-[10px] text-slate-600">Click to seek FlameChart</span>
      </div>
    </div>
  );
});
