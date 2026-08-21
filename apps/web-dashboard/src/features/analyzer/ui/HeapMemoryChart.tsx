/**
 * HeapMemoryChart — D3 area chart of JS heap usage over time.
 * Smooth area + line, target baseline, peak marker, GC-event dots,
 * crosshair hover with tooltip, click-to-seek via TimelineContext.
 */

import { useEffect, useRef, useMemo, memo } from 'react';
import * as d3 from 'd3';
import { MemoryStick, Activity, AlertTriangle } from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { cn } from '@/shared/lib/utils';
import { fmtMs } from '@/shared/lib/format';
// Tokens flow through as `var(--ld-*)` strings — resolving them to hex via
// getComputedStyle froze the palette at render time, so the chart kept its old
// colours across a light/dark toggle until the data happened to change.
import { CHART } from '@/shared/ui/chart';
import { useTimelineContext } from '../model/TimelineContext';
import type { HeapMemoryData, HeapMemoryPoint } from '@/entities/analysis';

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN = { top: 16, right: 16, bottom: 16, left: 16 };
const CHART_H = 180;
const GC_R    = 3.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMb(mb: number): string {
  return mb >= 100 ? `${mb.toFixed(0)} MB` : `${mb.toFixed(1)} MB`;
}


function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, valueClass }: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="rounded-[11px] border border-ld-border bg-ld-surface-2 px-[15px] py-[13px]">
      <p className="font-mono text-[10px] tracking-[.1em] uppercase text-ld-text-3 leading-none">
        {label}
      </p>
      <p className={cn('font-mono font-semibold text-[19px] leading-none tabular-nums mt-[4px]', valueClass ?? 'text-ld-text')}>
        {value}
      </p>
    </div>
  );
}

// ─── Warning chip ─────────────────────────────────────────────────────────────

function WarnChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-[6px] font-mono text-[11px] font-semibold px-[9px] py-[4px] rounded-[7px] border text-ld-amber border-ld-amber-line bg-ld-amber-wash">
      <span className="w-[7px] h-[7px] rounded-full bg-[currentColor] shrink-0" />
      {icon}
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { data: HeapMemoryData }

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
    const tMin   = data.points[0].timeMs;
    const tMax   = data.points[data.points.length - 1].timeMs;
    const cutoff = tMin + (tMax - tMin) * 0.8;
    const seg    = data.points.filter(p => p.timeMs >= cutoff);
    if (seg.length < 3) return false;
    let rising = 0;
    for (let i = 1; i < seg.length; i++) {
      if (seg[i].heapMb > seg[i - 1].heapMb) rising++;
    }
    return rising / (seg.length - 1) > 0.65;
  }, [data]);

  const leakDelta = useMemo<number | null>(() => {
    if (!hasPotentialLeak || gcBaseline === null) return null;
    const last = data.points[data.points.length - 1];
    return last ? +(last.heapMb - gcBaseline).toFixed(1) : null;
  }, [hasPotentialLeak, gcBaseline, data]);

  const hasPersistentFootprint = useMemo<boolean>(() => {
    if (gcBaseline === null) return false;
    const gcPts = data.points.filter(p => p.isGC).sort((a, b) => a.timeMs - b.timeMs);
    if (gcPts.length < 2) return false;
    const threshold = gcBaseline * 1.12;
    for (let i = 0; i < gcPts.length - 1; i++) {
      const tA = gcPts[i].timeMs;
      const tB = gcPts[i + 1].timeMs;
      const window = data.points.filter(p => p.timeMs > tA && p.timeMs < tB && !p.isGC);
      if (window.length === 0) continue;
      const minInWindow = Math.min(...window.map(p => p.heapMb));
      if (minInWindow <= threshold) return false;
    }
    return true;
  }, [data, gcBaseline]);

  // ── D3 render ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const wrap  = wrapRef.current;
    const svgEl = svgRef.current;
    const tip   = tooltipRef.current;
    if (!wrap || !svgEl || !tip || data.points.length === 0) return;

    // Downsample to ≤ 300 points, preserving GC events
    const pts = (() => {
      if (data.points.length <= 300) return data.points;
      const step = Math.ceil(data.points.length / 300);
      const out: typeof data.points = [];
      for (let i = 0; i < data.points.length; i++) {
        if (i % step === 0 || data.points[i].isGC) out.push(data.points[i]);
      }
      if (out[out.length - 1] !== data.points[data.points.length - 1]) {
        out.push(data.points[data.points.length - 1]);
      }
      return out;
    })();

    const totalW = wrap.clientWidth;
    const innerW = totalW - MARGIN.left - MARGIN.right;
    const innerH = CHART_H;
    const totalH = innerH + MARGIN.top + MARGIN.bottom;

    const xDomain = d3.extent(data.points, p => p.timeMs) as [number, number];
    const yMax    = data.peakMb * 1.1;

    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

    const svg = d3.select(svgEl).attr('width', totalW).attr('height', totalH);
    svg.selectAll('*').remove();

    // ── Gradient def ─────────────────────────────────────────────────────────

    const gradId = 'hm-area-grad';
    const defs   = svg.append('defs');
    const grad   = defs.append('linearGradient')
      .attr('id', gradId).attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', MARGIN.top)
      .attr('x2', 0).attr('y2', MARGIN.top + innerH);
    grad.append('stop').attr('offset', '0%')
      .attr('stop-color', CHART.accent).attr('stop-opacity', 0.22);
    grad.append('stop').attr('offset', '100%')
      .attr('stop-color', CHART.accent).attr('stop-opacity', 0);

    const clipId = 'hm-clip';
    defs.append('clipPath').attr('id', clipId)
      .append('rect').attr('width', innerW).attr('height', innerH);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // ── Gridlines (horizontal only) ───────────────────────────────────────────

    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(4))
      .enter().append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
      .attr('stroke', CHART.grid).attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 4');

    // ── Target Baseline line ──────────────────────────────────────────────────

    if (gcBaseline !== null) {
      const baseY = yScale(gcBaseline);
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', baseY).attr('y2', baseY)
        .attr('stroke', CHART.accentLine).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6 4');
    }

    // ── Area path ─────────────────────────────────────────────────────────────

    const areaGen = d3.area<HeapMemoryPoint>()
      .x(p => xScale(p.timeMs)).y0(innerH).y1(p => yScale(p.heapMb))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append('path').datum(pts)
      .attr('clip-path', `url(#${clipId})`)
      .attr('fill', `url(#${gradId})`).attr('d', areaGen);

    // ── Line path ─────────────────────────────────────────────────────────────

    const lineGen = d3.line<HeapMemoryPoint>()
      .x(p => xScale(p.timeMs)).y(p => yScale(p.heapMb))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append('path').datum(pts)
      .attr('clip-path', `url(#${clipId})`)
      .attr('fill', 'none')
      .attr('stroke', CHART.accent).attr('stroke-width', 2)
      .attr('d', lineGen);

    // ── Peak marker ───────────────────────────────────────────────────────────

    const peakIdx = d3.maxIndex(data.points, p => p.heapMb);
    if (peakIdx >= 0) {
      const peak = data.points[peakIdx];
      const px = xScale(peak.timeMs);
      const py = yScale(peak.heapMb);
      g.append('circle').attr('cx', px).attr('cy', py).attr('r', 7)
        .attr('fill', CHART.rose).attr('opacity', 0.15)
        .attr('clip-path', `url(#${clipId})`);
      g.append('circle').attr('cx', px).attr('cy', py).attr('r', 4)
        .attr('fill', CHART.rose).attr('opacity', 0.9)
        .attr('clip-path', `url(#${clipId})`);
    }

    // ── GC event dots ─────────────────────────────────────────────────────────

    const gcPoints = data.points.filter(p => p.isGC);
    const gcGroup  = g.append('g').attr('clip-path', `url(#${clipId})`);

    gcGroup.selectAll<SVGCircleElement, HeapMemoryPoint>('circle.gc-glow')
      .data(gcPoints).enter().append('circle').attr('class', 'gc-glow')
      .attr('cx', p => xScale(p.timeMs)).attr('cy', p => yScale(p.heapMb))
      .attr('r', GC_R + 3).attr('fill', CHART.accent).attr('opacity', 0.15);

    gcGroup.selectAll<SVGCircleElement, HeapMemoryPoint>('circle.gc-dot')
      .data(gcPoints).enter().append('circle').attr('class', 'gc-dot')
      .attr('cx', p => xScale(p.timeMs)).attr('cy', p => yScale(p.heapMb))
      .attr('r', GC_R).attr('fill', CHART.accent)
      .attr('stroke', CHART.accent).attr('stroke-opacity', 0.5).attr('stroke-width', 1)
      .attr('opacity', 0.9);

    // ── Crosshair + hover dot ─────────────────────────────────────────────────

    const bisect = d3.bisector<HeapMemoryPoint, number>(p => p.timeMs).left;

    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', CHART.accent).attr('stroke-width', 1)
      .attr('opacity', 0).attr('pointer-events', 'none');

    const hoverDot = g.append('circle').attr('r', 4)
      .attr('fill', CHART.accent).attr('stroke', CHART.surface).attr('stroke-width', 2)
      .attr('opacity', 0).attr('pointer-events', 'none');

    // ── Overlay ───────────────────────────────────────────────────────────────

    g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('mousemove', (evt: MouseEvent) => {
        const [mx]   = d3.pointer(evt);
        const timeMs = xScale.invert(mx);
        const idx    = bisect(data.points, timeMs, 1);
        const a      = data.points[idx - 1];
        const b      = data.points[idx];
        if (!a) return;
        const pt    = b && Math.abs(b.timeMs - timeMs) < Math.abs(a.timeMs - timeMs) ? b : a;
        const ptIdx = data.points.indexOf(pt);
        const prev  = ptIdx > 0 ? data.points[ptIdx - 1] : null;

        crosshair.attr('x1', xScale(pt.timeMs)).attr('x2', xScale(pt.timeMs)).attr('opacity', 0.6);
        hoverDot.attr('cx', xScale(pt.timeMs)).attr('cy', yScale(pt.heapMb)).attr('opacity', 1);

        let pctLine = '';
        if (prev) {
          const pct   = ((pt.heapMb - prev.heapMb) / prev.heapMb) * 100;
          const color = pct >= 0 ? CHART.rose : CHART.accent;
          pctLine = `<div style="color:${color};font-size:10px;margin-top:2px">${fmtPct(pct)} vs prev</div>`;
        }
        const domLine = pt.domNodes != null
          ? `<div style="opacity:0.6;font-size:10px;margin-top:2px">DOM nodes: ${pt.domNodes.toLocaleString()}</div>`
          : '';
        const gcLine  = pt.isGC
          ? `<div style="color:${CHART.accent};font-size:10px;margin-top:3px">⬤ GC event</div>`
          : '';

        tip.style.display = 'block';
        tip.style.left    = `${Math.min(evt.clientX + 14, window.innerWidth - 220)}px`;
        tip.style.top     = `${evt.clientY - 8}px`;
        tip.innerHTML = `
          <div style="font-weight:600;margin-bottom:2px">${fmtMb(pt.heapMb)}</div>
          <div style="opacity:0.6;font-size:10px">@ ${fmtMs(pt.timeMs)}</div>
          ${pctLine}${domLine}${gcLine}
        `;
      })
      .on('click', (evt: MouseEvent) => {
        if (!ctx) return;
        const [mx]   = d3.pointer(evt);
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
    <Panel>
      <PanelHeader icon={<MemoryStick />} title="JS Heap Memory" meta={`${fmtMb(data.peakMb)} peak`}>
        {hasPotentialLeak && (
          <WarnChip
            icon={<AlertTriangle className="w-[11px] h-[11px]" />}
            label={leakDelta !== null ? `Potential leak +${leakDelta} MB` : 'Potential leak'}
          />
        )}
        {hasPersistentFootprint && !hasPotentialLeak && (
          <WarnChip
            icon={<Activity className="w-[11px] h-[11px]" />}
            label="Persistent footprint"
          />
        )}
      </PanelHeader>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 max-[760px]:grid-cols-1 gap-[14px] px-[18px] py-[16px]">
        <StatCard
          label="GC Baseline"
          value={gcBaseline !== null ? fmtMb(gcBaseline) : '—'}
        />
        <StatCard
          label="Peak Heap"
          value={fmtMb(data.peakMb)}
          valueClass={data.peakMb > 200 ? 'text-ld-rose' : data.peakMb > 100 ? 'text-ld-amber' : undefined}
        />
        <StatCard
          label="GC Events"
          value={gcCount > 0 ? String(gcCount) : '—'}
          valueClass={gcCount > 0 ? 'text-[var(--ld-accent-2)]' : undefined}
        />
      </div>

      {/* ── Chart + legend ────────────────────────────────────────────────── */}
      <div className="px-[18px] pb-[18px]">
        <div
          ref={wrapRef}
          className="rounded-[12px] border border-ld-border bg-ld-bg-2 relative select-none overflow-hidden"
        >
          <svg ref={svgRef} className="block w-full" />

          {/* Legend */}
          <div className="flex items-center gap-[16px] px-[14px] pb-[12px] flex-wrap">
            <span className="inline-flex items-center gap-[7px] text-[11.5px] text-ld-text-3">
              <span className="block w-[14px] h-[3px] rounded-[2px] bg-ld-accent shrink-0" />
              JS Heap Used
            </span>
            {gcBaseline !== null && (
              <span className="inline-flex items-center gap-[7px] text-[11.5px] text-ld-text-3">
                <span className="block w-[14px] h-[3px] rounded-[2px] bg-ld-accent-line shrink-0" />
                Target Baseline
              </span>
            )}
            <span className="inline-flex items-center gap-[7px] text-[11.5px] text-ld-text-3">
              <span className="block w-[8px] h-[8px] rounded-full bg-ld-rose shrink-0" />
              Peak
            </span>
            {gcCount > 0 && (
              <span className="inline-flex items-center gap-[7px] text-[11.5px] text-ld-text-3">
                <span className="block w-[8px] h-[8px] rounded-full bg-ld-accent shrink-0" />
                GC Event
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tooltip — fixed to viewport, escapes Panel overflow:hidden */}
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[200] hidden rounded-[10px] border border-ld-border bg-ld-surface shadow-ld-shadow-card px-[12px] py-[10px] text-[12px] text-ld-text-2 max-w-[210px]"
      />
    </Panel>
  );
});
