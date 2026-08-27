import * as d3 from 'd3';
import { fmtMs } from '@/shared/lib/format';
// Tokens flow through as `var(--ld-*)` strings — resolving them to hex via getComputedStyle
// froze the palette at render time, so the chart kept its old colours across a light/dark
// toggle until the data happened to change.
import { CHART } from '@/shared/ui/chart';
import {
  vitalBand, BAND_LABEL,
  type ScoreBand, type InteractionData, type InteractionEvent, type LongTaskSegment,
} from '@/entities/analysis';

/**
 * The D3 half of the interaction panel: long-task zones, the axis, and one pin per
 * interaction, with the tooltip and the click behaviour that go with them.
 *
 * Lifted out of `InteractionTimeline.tsx`, which was 545 lines of two different things —
 * a React panel of banners, stat cards and a detail block, wrapped around 230 lines of
 * imperative SVG. Nothing about the drawing is React, and keeping it inside the component
 * meant every read of either had to scroll past the other.
 *
 * The selection is read through `getSelectedId` rather than captured: the effect that used
 * to own this ran on `data` alone, so the handler compared against whatever the selection
 * was when the chart was last drawn. A second effect repainted the rings afterwards and
 * hid it.
 */

const MARGIN   = { top: 28, right: 24, bottom: 48, left: 60 };
const CHART_H  = 210;
const PIN_LINE = 54;
const CIRCLE_R = 9;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max = 14): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export interface InteractionChartOptions {
  /** The `<svg>` to draw into; cleared first. */
  svg:  SVGSVGElement;
  /** Measured for the available width. */
  wrap: HTMLElement;
  /** The floating tooltip element, positioned and filled imperatively. */
  tip:  HTMLElement;
  data: InteractionData;
  /** Read at event time, never captured — see above. */
  getSelectedId: () => string | null;
  /** A pin was clicked; the caller decides whether that selects or deselects. */
  onSelect: (id: string) => void;
  /** A long-task zone was clicked: focus that window in the flame chart. */
  onZoom: (fromMs: number, toMs: number) => void;
}

export function drawInteractionChart({
  svg, wrap, tip, data, getSelectedId, onSelect, onZoom,
}: InteractionChartOptions): void {
  const BAND_C: Record<ScoreBand, string> = { good: CHART.accent, warn: CHART.amber, poor: CHART.rose };
  const intColor = (ms: number) => BAND_C[vitalBand('inp', ms)];

  const totalW = wrap.clientWidth;
  const innerW = totalW - MARGIN.left - MARGIN.right;
  const innerH = CHART_H - MARGIN.top - MARGIN.bottom;
  const circleY = innerH - PIN_LINE;

  d3.select(svg).selectAll('*').remove();
  const root = d3.select(svg).attr('width', totalW).attr('height', CHART_H);
  const g = root.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  const maxEventMs = data.events.length ? Math.max(...data.events.map(e => e.startMs)) : 0;
  const maxTaskMs  = data.longTasks.length ? Math.max(...data.longTasks.map(t => t.startMs + t.durationMs)) : 0;
  const xScale = d3.scaleLinear()
    .domain([0, Math.max(maxEventMs, maxTaskMs, 1) * 1.08])
    .range([0, innerW]);

  // Vertical grid
  xScale.ticks(6).forEach(tick => {
    g.append('line')
      .attr('x1', xScale(tick)).attr('x2', xScale(tick))
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', CHART.grid)
      .attr('stroke-dasharray', '3,4');
  });

  // ── Blocking zones ────────────────────────────────────────────────────────

  const zoneG = g.selectAll<SVGGElement, LongTaskSegment>('.blocking-zone-g')
    .data(data.longTasks).enter()
    .append('g').attr('class', 'blocking-zone-g')
    .style('cursor', 'pointer');

  zoneG.append('rect')
    .attr('class', 'blocking-rect')
    .attr('x',      lt => xScale(lt.startMs))
    .attr('width',  lt => Math.max(1, xScale(lt.startMs + lt.durationMs) - xScale(lt.startMs)))
    .attr('y', 0).attr('height', innerH)
    .attr('fill',         'var(--ld-rose-wash)')
    .attr('stroke',       'var(--ld-rose-fill)')
    .attr('stroke-width', 0.5);

  zoneG.filter(lt => xScale(lt.startMs + lt.durationMs) - xScale(lt.startMs) > 46)
    .append('text')
    .attr('x', lt => xScale(lt.startMs) + 4).attr('y', 9)
    .attr('fill', CHART.rose).attr('fill-opacity', 0.55)
    .attr('font-size', '8px').text('Long Task');

  zoneG
    .on('mouseenter', function(event: MouseEvent, lt: LongTaskSegment) {
      d3.select(this).select<SVGRectElement>('.blocking-rect')
        .attr('fill', 'var(--ld-rose-fill)')
        .attr('stroke', 'var(--ld-rose-strong)');
      tip.style.display = 'block';
      tip.style.left    = `${Math.min(event.clientX + 14, window.innerWidth - 220)}px`;
      tip.style.top     = `${Math.max(event.clientY - 70, 4)}px`;
      tip.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:${CHART.rose};margin-bottom:4px">
          Long Task: ${fmtMs(lt.durationMs)}
        </div>
        <div style="font-size:10px;color:${CHART.axis};line-height:1.8">
          Start: ${fmtMs(lt.startMs)}<br/>
          ${lt.topFunctionName
            ? `Top fn: <span style="color:${CHART.amber};font-family:monospace">${lt.topFunctionName}</span>`
            : `Top fn: <span style="opacity:0.5">not identified</span>`}
        </div>
      `;
    })
    .on('mousemove', function(event: MouseEvent) {
      tip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 220)}px`;
      tip.style.top  = `${Math.max(event.clientY - 70, 4)}px`;
    })
    .on('mouseleave', function() {
      d3.select(this).select<SVGRectElement>('.blocking-rect')
        .attr('fill',   'var(--ld-rose-wash)')
        .attr('stroke', 'var(--ld-rose-fill)');
      tip.style.display = 'none';
    })
    .on('click', (_: MouseEvent, lt: LongTaskSegment) => {
      onZoom(lt.startMs, lt.startMs + lt.durationMs);
    });

  // ── X axis ────────────────────────────────────────────────────────────────

  g.append('g')
    .attr('transform', `translate(0, ${innerH})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => fmtMs(Number(d))))
    .call(ax => ax.select('.domain').attr('stroke', CHART.gridStrong))
    .call(ax => ax.selectAll('text').attr('fill', CHART.axis).attr('font-size', '10px'))
    .call(ax => ax.selectAll('.tick line').attr('stroke', CHART.grid));

  g.append('text')
    .attr('x', innerW / 2).attr('y', innerH + 36)
    .attr('text-anchor', 'middle')
    .attr('fill', CHART.axis).attr('fill-opacity', 0.6).attr('font-size', '9px')
    .text('Time from navigation start');

  g.append('line')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', innerH).attr('y2', innerH)
    .attr('stroke', CHART.gridStrong);

  // ── Interaction pins ──────────────────────────────────────────────────────

  if (data.events.length > 0) {
    const pinG = g.selectAll<SVGGElement, InteractionEvent>('.pin')
      .data(data.events).enter()
      .append('g').attr('class', 'pin')
      .attr('transform', ev => `translate(${xScale(ev.startMs)}, 0)`)
      .style('cursor', 'pointer');

    pinG.append('line')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', circleY + CIRCLE_R).attr('y2', innerH)
      .attr('stroke', ev => intColor(ev.totalDurationMs))
      .attr('stroke-width', ev => ev.isINP ? 2 : 1.5)
      .attr('stroke-dasharray', ev => ev.isINP ? null : '3,2');

    pinG.append('circle')
      .attr('cy', circleY)
      .attr('r',  ev => ev.isINP ? CIRCLE_R + 2 : CIRCLE_R)
      .attr('fill',         ev => intColor(ev.totalDurationMs))
      .attr('fill-opacity', ev => ev.isINP ? 0.3 : 0.15)
      .attr('stroke',       ev => intColor(ev.totalDurationMs))
      .attr('stroke-width', ev => ev.isINP ? 2 : 1.5);

    pinG.append('text')
      .attr('y', circleY + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', ev => ev.isINP ? '11px' : '9px')
      .attr('fill', ev => intColor(ev.totalDurationMs))
      .text(ev => ev.isUserInput ? '⚡' : '●');

    pinG.filter(ev => ev.isINP)
      .append('text')
      .attr('y', circleY - CIRCLE_R - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px').attr('font-weight', '700')
      .attr('fill', CHART.rose).text('INP');

    pinG.append('circle')
      .attr('class', 'selected-ring')
      .attr('cy', circleY).attr('r', CIRCLE_R + 5)
      .attr('fill', 'none')
      .attr('stroke', ev => intColor(ev.totalDurationMs))
      .attr('stroke-width', 2)
      .attr('opacity', ev => ev.id === getSelectedId() ? 1 : 0);

    const labelBaseY = circleY + CIRCLE_R + 10;

    pinG.append('text')
      .attr('y', labelBaseY + 9)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8.5px').attr('font-weight', '500')
      .attr('fill', ev => intColor(ev.totalDurationMs))
      .text(ev => truncate(capitalize(ev.type), 12));

    pinG.append('text')
      .attr('y', labelBaseY + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '7.5px').attr('fill', CHART.axis)
      .text(ev => truncate(ev.targetElement.toLowerCase(), 14));

    pinG
      .on('mouseenter', function(event: MouseEvent, ev: InteractionEvent) {
        d3.select<SVGGElement, InteractionEvent>(this).select('.selected-ring').attr('opacity', 0.7);
        const col = intColor(ev.totalDurationMs);
        tip.style.display = 'block';
        tip.style.left    = `${Math.min(event.clientX + 14, window.innerWidth - 200)}px`;
        tip.style.top     = `${Math.max(event.clientY - 90, 4)}px`;
        tip.innerHTML = `
          <div style="font-size:10px;color:${CHART.axis};margin-bottom:4px">
            ${capitalize(ev.type)} · ${fmtMs(ev.startMs)}
          </div>
          <div style="font-size:13px;font-weight:700;color:${col};margin-bottom:6px">
            ${fmtMs(ev.totalDurationMs)} <span style="font-size:10px;font-weight:400">${BAND_LABEL[vitalBand('inp', ev.totalDurationMs)]}</span>
          </div>
          <div style="font-size:10px;color:${CHART.axis};line-height:1.7">
            <span style="color:${CHART.amber}">■</span> Input Delay&nbsp;&nbsp;&nbsp;${fmtMs(ev.inputDelayMs)}<br/>
            <span style="color:#a855f7">■</span> Processing&nbsp;&nbsp;&nbsp;&nbsp;${fmtMs(ev.processingTimeMs)}<br/>
            <span style="color:#3b82f6">■</span> Presentation&nbsp;&nbsp;${fmtMs(ev.presentationDelayMs)}
          </div>
        `;
      })
      .on('mouseleave', function(_: MouseEvent, ev: InteractionEvent) {
        if (ev.id !== getSelectedId()) {
          d3.select<SVGGElement, InteractionEvent>(this).select('.selected-ring').attr('opacity', 0);
        }
        tip.style.display = 'none';
      })
      .on('click', (_: MouseEvent, ev: InteractionEvent) => {
        onSelect(ev.id);
      });
  }
}
