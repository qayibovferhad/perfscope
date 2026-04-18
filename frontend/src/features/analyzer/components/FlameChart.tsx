import { useEffect, useRef, memo } from 'react';
import * as d3 from 'd3';
import { useTimelineContext } from '../context/TimelineContext';
import type { FlameChartData, FlameChartEvent } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROW_H = 16;

const COLORS: Record<FlameChartEvent['category'], string> = {
  scripting: '#FFCD42',
  rendering: '#AF5CF7',
  painting:  '#209653',
  other:     '#637087',
};

const CATEGORY_LABELS: Record<FlameChartEvent['category'], string> = {
  scripting: 'Scripting',
  rendering: 'Rendering',
  painting:  'Painting',
  other:     'Other',
};

// ─── Tooltip content ──────────────────────────────────────────────────────────

function buildTooltipHtml(d: FlameChartEvent): string {
  const dur = d.durationMs >= 1
    ? `${d.durationMs.toFixed(1)}ms`
    : `${(d.durationMs * 1000).toFixed(0)}µs`;
  const longTaskBadge = d.isLongTask
    ? `<span style="color:#ef4444;font-weight:600"> ⚠ Long Task</span>`
    : '';
  const urlPart = d.url
    ? `<div style="opacity:0.55;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px" title="${d.url}">${shortUrl(d.url)}</div>`
    : '';
  return `
    <div style="font-weight:600;margin-bottom:2px">${d.name}${longTaskBadge}</div>
    <div style="opacity:0.75">${CATEGORY_LABELS[d.category]} · ${dur}</div>
    ${urlPart}
  `;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const file = u.pathname.split('/').pop() ?? '';
    return file || u.hostname;
  } catch {
    return url.split('/').pop() ?? url;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data:   FlameChartData;
  axisMs: number;
  leftW:  number;   // must match waterfall LEFT_W for X-axis alignment
}

export const FlameChart = memo(function FlameChart({ data, axisMs, leftW }: Props) {
  const wrapRef      = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);
  const ghostRef     = useRef<SVGLineElement | null>(null);
  const zoomRef      = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const xScaleRef    = useRef<d3.ScaleLinear<number, number>>(d3.scaleLinear());
  const ctx          = useTimelineContext();

  const maxDisplayDepth = Math.min(data.maxDepth, 20);
  const svgH            = (maxDisplayDepth + 1) * ROW_H + 4;

  // ── D3 render ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    const svgEl = svgRef.current;
    const tip = tooltipRef.current;
    if (!wrap || !svgEl || !tip) return;

    const totalW = wrap.clientWidth;
    const chartW = totalW - leftW;
    if (chartW <= 0) return;

    // X scale
    const xScale = d3.scaleLinear().domain([0, axisMs]).range([0, chartW]);
    xScaleRef.current = xScale;

    const svg = d3.select(svgEl)
      .attr('width', totalW)
      .attr('height', svgH);

    svg.selectAll('*').remove();

    // Clipping rect (confine rects to chart area)
    const clipId = 'fc-clip';
    svg.append('defs')
      .append('clipPath').attr('id', clipId)
      .append('rect').attr('width', chartW).attr('height', svgH);

    // Outer group shifted by leftW
    const outer = svg.append('g').attr('transform', `translate(${leftW},0)`);

    // Content group — zoom transform applied here
    const content = outer.append('g')
      .attr('class', 'fc-content')
      .attr('clip-path', `url(#${clipId})`);

    // ── Render rects ──────────────────────────────────────────────────────────
    const visibleEvents = data.events.filter(e => e.depth <= maxDisplayDepth);

    content.selectAll<SVGRectElement, FlameChartEvent>('rect.fc-event')
      .data(visibleEvents)
      .enter()
      .append('rect')
      .attr('class', 'fc-event')
      .attr('x',      d => xScale(d.startMs))
      .attr('y',      d => d.depth * ROW_H + 1)
      .attr('width',  d => Math.max(xScale(d.startMs + d.durationMs) - xScale(d.startMs), 1))
      .attr('height', ROW_H - 2)
      .attr('rx', 1)
      .attr('fill',         d => COLORS[d.category])
      .attr('opacity',      0.88)
      .attr('stroke',       d => d.isLongTask ? '#ef4444' : 'none')
      .attr('stroke-width', d => d.isLongTask ? 1.5 : 0)
      // ── Tooltip ────────────────────────────────────────────────────────────
      .on('mouseenter', (_evt, d) => {
        tip.style.display = 'block';
        tip.innerHTML = buildTooltipHtml(d);
      })
      .on('mousemove', (evt: MouseEvent) => {
        const tx = Math.min(evt.clientX + 14, window.innerWidth - 260);
        const ty = evt.clientY - 8;
        tip.style.left = `${tx}px`;
        tip.style.top  = `${ty}px`;
      })
      .on('mouseleave', () => { tip.style.display = 'none'; });

    // ── Ghost line (outside zoom group so it sits on top) ─────────────────────
    const ghost = outer.append('line')
      .attr('class', 'fc-ghost')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', 0).attr('y2', svgH)
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.75)
      .attr('pointer-events', 'none');

    ghostRef.current = ghost.node();

    // Position ghost line at current motionMs
    if (ctx) {
      const x = zoomRef.current.applyX(xScaleRef.current(ctx.motionMs.get()));
      ghost.attr('x1', x).attr('x2', x);
    }

    // ── D3 Zoom ───────────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 80])
      .translateExtent([[0, 0], [chartW, svgH]])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        zoomRef.current = event.transform;
        content.attr('transform', event.transform.toString());

        // Re-position ghost line with zoom
        if (ghostRef.current && ctx) {
          const x = event.transform.applyX(xScaleRef.current(ctx.motionMs.get()));
          d3.select(ghostRef.current).attr('x1', x).attr('x2', x);
        }
      });

    svg.call(zoom);

    // Double-click resets zoom
    svg.on('dblclick.zoom', () => {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });

    return () => { tip.style.display = 'none'; };
  }, [data, axisMs, leftW, svgH, maxDisplayDepth, ctx]);

  // ── Ghost line sync with motionMs (imperative, no React re-render) ──────────
  useEffect(() => {
    if (!ctx) return;
    return ctx.motionMs.on('change', (sliderMs) => {
      if (!ghostRef.current) return;
      const x = zoomRef.current.applyX(xScaleRef.current(sliderMs));
      d3.select(ghostRef.current).attr('x1', x).attr('x2', x);
    });
  }, [ctx]);

  // ── Waterfall hover → highlight matching flame events (imperative D3) ────────
  useEffect(() => {
    
    if (!ctx) return;
    return ctx.hoveredUrl.on('change', (url: string) => {
      console.log(url,'url');
      
      if (!svgRef.current) return;
      d3.select(svgRef.current)
        .selectAll<SVGRectElement, FlameChartEvent>('rect.fc-event')
        .attr('opacity', d => {
          if (!url) return 0.88;
          console.log( d.url === url);
          
          return d.url === url ? 1 : 0.12;
        })
        .attr('stroke', d => {
          if (!url) return d.isLongTask ? '#ef4444' : 'none';
          if (d.url === url) return '#e2e8f0';
          return d.isLongTask ? '#ef4444' : 'none';
        })
        .attr('stroke-width', d => {
          if (!url) return d.isLongTask ? 1.5 : 0;
          if (d.url === url) return 2;
          return d.isLongTask ? 1.5 : 0;
        });
    });
  }, [ctx]);

  return (
    <div ref={wrapRef} className="relative select-none">
      <svg ref={svgRef} style={{ display: 'block', width: '100%', height: svgH }} />

      {/* Tooltip — fixed position, managed imperatively */}
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[200] hidden rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-[11px] text-slate-200 shadow-xl"
        style={{ maxWidth: 260 }}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-slate-800/60 flex-wrap">
        {(Object.entries(COLORS) as [FlameChartEvent['category'], string][]).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            <span className="text-[10px] text-slate-500">{CATEGORY_LABELS[cat]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border border-red-500 bg-transparent" />
          <span className="text-[10px] text-slate-500">Long Task (&gt;50ms)</span>
        </div>
        <span className="ml-auto text-[10px] text-slate-600">Scroll to zoom · Double-click to reset</span>
      </div>
    </div>
  );
});
