/**
 * InteractionTimeline — Visualizes user interaction responsiveness (FID/INP) from trace data.
 *
 * • Executive Summary: dynamic health status above score cards
 * • 3 score cards: Max INP, Avg Input Delay, Total Blocking Time
 * • D3 timeline:
 *   - Hoverable red blocking zones for Long Tasks (tooltip + darkens on hover)
 *   - Click blocking zone → zoom FlameChart to that time interval
 *   - ⚡/● pin markers per event, color-coded, with event+target labels below
 *   - INP crown above the worst interaction
 * • Click-selected detail panel: stacked bar + 4-cell grid + blocking info
 * • Empty state only when events array is completely empty
 */

import { useEffect, useRef, useState, useMemo, memo } from 'react';
import * as d3 from 'd3';
import { Zap, Clock, AlertTriangle, MousePointerClick, Code2, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useTimelineContext } from '../context/TimelineContext';
import type { InteractionData, InteractionEvent, LongTaskSegment } from '../types';

// ─── Layout ───────────────────────────────────────────────────────────────────

const MARGIN   = { top: 28, right: 24, bottom: 48, left: 60 };
const CHART_H  = 210;
const PIN_LINE = 54;
const CIRCLE_R = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function interactionColor(ms: number) {
  if (ms < 100) return '#22c55e';
  if (ms < 300) return '#f97316';
  return '#ef4444';
}

function interactionBg(ms: number) {
  if (ms < 100) return 'rgba(34,197,94,0.12)';
  if (ms < 300) return 'rgba(249,115,22,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function ratingLabel(ms: number) {
  if (ms < 100) return 'Fast';
  if (ms < 300) return 'Needs work';
  return 'Slow';
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max = 14) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── Executive Summary ────────────────────────────────────────────────────────

function HealthSummary({ inpMs, tbtMs }: { inpMs: number; tbtMs: number }) {
  const issues: Array<{ icon: string; text: string; color: string; bg: string }> = [];

  if (tbtMs > 500) {
    issues.push({
      icon: '⚠️',
      text: 'High Main Thread blocking detected. UI might feel laggy during load.',
      color: '#f97316',
      bg:   'rgba(249,115,22,0.08)',
    });
  }
  if (inpMs > 200) {
    issues.push({
      icon: '🔴',
      text: 'Critical interaction delay found. User clicks are being held up by long tasks.',
      color: '#ef4444',
      bg:   'rgba(239,68,68,0.08)',
    });
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
        <p className="text-sm text-green-400">
          ✅ Responsiveness is within healthy limits.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-lg border px-4 py-3"
          style={{ borderColor: issue.color + '30', background: issue.bg }}
        >
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" style={{ color: issue.color }} />
          <p className="text-sm" style={{ color: issue.color }}>
            {issue.icon} {issue.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Score Card ───────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0" style={{ color }}>{icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            <p className="text-xl font-bold mt-1 leading-none" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stacked Bar ──────────────────────────────────────────────────────────────

function StackedBar({ ev }: { ev: InteractionEvent }) {
  const total = ev.totalDurationMs || 1;
  const segs = [
    { label: 'Input Delay',  ms: ev.inputDelayMs,        color: '#f97316' },
    { label: 'Processing',   ms: ev.processingTimeMs,    color: '#a855f7' },
    { label: 'Presentation', ms: ev.presentationDelayMs, color: '#3b82f6' },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 rounded overflow-hidden w-full">
        {segs.map(s => (
          <div key={s.label} style={{ width: `${(s.ms / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${fmtMs(s.ms)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {segs.map(s => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px]">
            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium">{fmtMs(s.ms)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const InteractionTimeline = memo(function InteractionTimeline({ data }: { data: InteractionData }) {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const ctx        = useTimelineContext();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => data.events.find(e => e.id === selectedId) ?? null,
    [data.events, selectedId],
  );

  // ── D3 render ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg  = svgRef.current;
    const tip  = tooltipRef.current;
    if (!wrap || !svg || !tip) return;

    const totalW = wrap.clientWidth;
    const innerW = totalW - MARGIN.left - MARGIN.right;
    const innerH = CHART_H - MARGIN.top - MARGIN.bottom;
    const circleY = innerH - PIN_LINE;

    d3.select(svg).selectAll('*').remove();
    const root = d3.select(svg).attr('width', totalW).attr('height', CHART_H);
    const g = root.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scale — domain covers both events and long tasks
    const maxEventMs = data.events.length ? Math.max(...data.events.map(e => e.startMs)) : 0;
    const maxTaskMs  = data.longTasks.length ? Math.max(...data.longTasks.map(t => t.startMs + t.durationMs)) : 0;
    const xScale = d3.scaleLinear().domain([0, Math.max(maxEventMs, maxTaskMs, 1) * 1.08]).range([0, innerW]);

    // Grid
    xScale.ticks(6).forEach(tick => {
      g.append('line')
        .attr('x1', xScale(tick)).attr('x2', xScale(tick))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', 'rgba(255,255,255,0.04)')
        .attr('stroke-dasharray', '3,4');
    });

    // ── Hoverable Blocking Zones ──────────────────────────────────────────────

    const zoneG = g.selectAll<SVGGElement, LongTaskSegment>('.blocking-zone-g')
      .data(data.longTasks)
      .enter()
      .append('g')
      .attr('class', 'blocking-zone-g')
      .style('cursor', 'pointer');

    zoneG.append('rect')
      .attr('class', 'blocking-rect')
      .attr('x',      lt => xScale(lt.startMs))
      .attr('width',  lt => Math.max(1, xScale(lt.startMs + lt.durationMs) - xScale(lt.startMs)))
      .attr('y', 0)
      .attr('height', innerH)
      .attr('fill',         'rgba(239,68,68,0.07)')
      .attr('stroke',       'rgba(239,68,68,0.18)')
      .attr('stroke-width', 0.5);

    // "Long Task" text label for wide enough zones
    zoneG.filter(lt => xScale(lt.startMs + lt.durationMs) - xScale(lt.startMs) > 46)
      .append('text')
      .attr('x',    lt => xScale(lt.startMs) + 4)
      .attr('y',    9)
      .attr('fill', 'rgba(239,68,68,0.55)')
      .attr('font-size', '8px')
      .text('Long Task');

    // Hover: darken + show tooltip
    zoneG
      .on('mouseenter', function(event: MouseEvent, lt: LongTaskSegment) {
        d3.select(this).select<SVGRectElement>('.blocking-rect')
          .attr('fill', 'rgba(239,68,68,0.20)')
          .attr('stroke', 'rgba(239,68,68,0.45)');

        const rect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        tip.style.display     = 'block';
        tip.style.left        = `${Math.min(x + 14, totalW - 210)}px`;
        tip.style.top         = `${Math.max(y - 70, 4)}px`;
        tip.style.borderColor = 'rgba(239,68,68,0.6)';
        tip.innerHTML = `
          <div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:4px">
            Long Task: ${fmtMs(lt.durationMs)}
          </div>
          <div style="font-size:10px;color:#a1a1aa;line-height:1.8">
            Start Time: ${fmtMs(lt.startMs)}<br/>
            ${lt.topFunctionName
              ? `Top function: <span style="color:#fbbf24;font-family:monospace">${lt.topFunctionName}</span>`
              : 'Top function: <span style="opacity:0.5">not identified</span>'}
          </div>
        `;
      })
      .on('mousemove', function(event: MouseEvent) {
        const rect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
        tip.style.left = `${Math.min(event.clientX - rect.left + 14, totalW - 210)}px`;
        tip.style.top  = `${Math.max(event.clientY - rect.top - 70, 4)}px`;
      })
      .on('mouseleave', function() {
        d3.select(this).select<SVGRectElement>('.blocking-rect')
          .attr('fill',   'rgba(239,68,68,0.07)')
          .attr('stroke', 'rgba(239,68,68,0.18)');
        tip.style.display = 'none';
      })
      .on('click', (_: MouseEvent, lt: LongTaskSegment) => {
        ctx?.zoomFnRef.current?.(lt.startMs, lt.startMs + lt.durationMs);
      });

    // ── X axis ────────────────────────────────────────────────────────────────

    g.append('g')
      .attr('transform', `translate(0, ${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => fmtMs(Number(d))))
      .call(ax => ax.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(ax => ax.selectAll('text').attr('fill', '#71717a').attr('font-size', '10px'))
      .call(ax => ax.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.1)'));

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#3f3f46').attr('font-size', '9px')
      .text('Time from navigation start');

    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', innerH).attr('y2', innerH)
      .attr('stroke', 'rgba(255,255,255,0.15)');

    // ── Interaction Pins ──────────────────────────────────────────────────────

    if (data.events.length > 0) {
      const pinG = g.selectAll<SVGGElement, InteractionEvent>('.pin')
        .data(data.events)
        .enter()
        .append('g')
        .attr('class', 'pin')
        .attr('transform', ev => `translate(${xScale(ev.startMs)}, 0)`)
        .style('cursor', 'pointer');

      pinG.append('line')
        .attr('x1', 0).attr('x2', 0)
        .attr('y1', circleY + CIRCLE_R).attr('y2', innerH)
        .attr('stroke', ev => interactionColor(ev.totalDurationMs))
        .attr('stroke-width', ev => ev.isINP ? 2 : 1.5)
        .attr('stroke-dasharray', ev => ev.isINP ? null : '3,2');

      pinG.append('circle')
        .attr('cy', circleY)
        .attr('r',  ev => ev.isINP ? CIRCLE_R + 2 : CIRCLE_R)
        .attr('fill',         ev => interactionColor(ev.totalDurationMs))
        .attr('fill-opacity', ev => ev.isINP ? 0.3 : 0.15)
        .attr('stroke',       ev => interactionColor(ev.totalDurationMs))
        .attr('stroke-width', ev => ev.isINP ? 2 : 1.5);

      pinG.append('text')
        .attr('y', circleY + 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', ev => ev.isINP ? '11px' : '9px')
        .attr('fill', ev => interactionColor(ev.totalDurationMs))
        .text(ev => ev.isUserInput ? '⚡' : '●');

      pinG.filter(ev => ev.isINP)
        .append('text')
        .attr('y', circleY - CIRCLE_R - 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px').attr('font-weight', '700')
        .attr('fill', '#ef4444')
        .text('INP');

      pinG.append('circle')
        .attr('class', 'selected-ring')
        .attr('cy', circleY)
        .attr('r', CIRCLE_R + 5)
        .attr('fill', 'none')
        .attr('stroke', ev => interactionColor(ev.totalDurationMs))
        .attr('stroke-width', 2)
        .attr('opacity', ev => ev.id === selectedId ? 1 : 0);

      // Event type + target labels (below circle, above axis)
      const labelBaseY = circleY + CIRCLE_R + 10;

      pinG.append('text')
        .attr('y', labelBaseY + 9)
        .attr('text-anchor', 'middle')
        .attr('font-size', '8.5px').attr('font-weight', '500')
        .attr('fill', ev => interactionColor(ev.totalDurationMs))
        .text(ev => truncate(capitalize(ev.type), 12));

      pinG.append('text')
        .attr('y', labelBaseY + 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '7.5px')
        .attr('fill', '#71717a')
        .text(ev => truncate(ev.targetElement.toLowerCase(), 14));

      // Hover tooltip
      pinG
        .on('mouseenter', function(event: MouseEvent, ev: InteractionEvent) {
          d3.select<SVGGElement, InteractionEvent>(this).select('.selected-ring').attr('opacity', 0.7);
          const rect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
          const col  = interactionColor(ev.totalDurationMs);
          tip.style.display     = 'block';
          tip.style.left        = `${Math.min(event.clientX - rect.left + 14, totalW - 200)}px`;
          tip.style.top         = `${Math.max(event.clientY - rect.top - 90, 4)}px`;
          tip.style.borderColor = col;
          tip.innerHTML = `
            <div style="font-size:10px;color:#a1a1aa;margin-bottom:4px">
              ${capitalize(ev.type)} · ${fmtMs(ev.startMs)}
            </div>
            <div style="font-size:13px;font-weight:700;color:${col};margin-bottom:6px">
              ${fmtMs(ev.totalDurationMs)}&nbsp;<span style="font-size:10px;font-weight:400">${ratingLabel(ev.totalDurationMs)}</span>
            </div>
            <div style="font-size:10px;color:#a1a1aa;line-height:1.7">
              <span style="color:#f97316">■</span> Input Delay&nbsp;&nbsp;&nbsp;${fmtMs(ev.inputDelayMs)}<br/>
              <span style="color:#a855f7">■</span> Processing&nbsp;&nbsp;&nbsp;&nbsp;${fmtMs(ev.processingTimeMs)}<br/>
              <span style="color:#3b82f6">■</span> Presentation&nbsp;&nbsp;${fmtMs(ev.presentationDelayMs)}
            </div>
          `;
        })
        .on('mouseleave', function(_: MouseEvent, ev: InteractionEvent) {
          if (ev.id !== selectedId) {
            d3.select<SVGGElement, InteractionEvent>(this).select('.selected-ring').attr('opacity', 0);
          }
          tip.style.display = 'none';
        })
        .on('click', (_: MouseEvent, ev: InteractionEvent) => {
          setSelectedId(prev => prev === ev.id ? null : ev.id);
        });
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Sync selected ring imperatively
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, InteractionEvent>('.selected-ring')
      .attr('opacity', ev => ev.id === selectedId ? 1 : 0);
  }, [selectedId]);

  const seekToFlameChart = (ev: InteractionEvent) => ctx?.motionMs.set(ev.startMs);

  // ── Empty state ────────────────────────────────────────────────────────────

  if (data.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <MousePointerClick className="w-8 h-8 opacity-30" />
        <p className="text-sm">No interaction events detected in this trace.</p>
        <p className="text-xs opacity-60">EventDispatch events were not captured during the Lighthouse run.</p>
      </div>
    );
  }

  const inpColor = interactionColor(data.inpMs);
  const avgColor = interactionColor(data.avgInputDelayMs);
  const tbtColor = data.totalBlockingTimeMs > 600 ? '#ef4444'
    : data.totalBlockingTimeMs > 200 ? '#f97316' : '#22c55e';

  return (
    <div className="space-y-4">

      {/* ── Executive Summary ─────────────────────────────────────────────── */}
      <HealthSummary inpMs={data.inpMs} tbtMs={data.totalBlockingTimeMs} />

      {/* ── Score Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          icon={<Zap className="w-4 h-4" />}
          label="Max Interaction Delay (INP)"
          value={fmtMs(data.inpMs)}
          color={inpColor}
          sub={ratingLabel(data.inpMs)}
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Average Input Delay"
          value={fmtMs(data.avgInputDelayMs)}
          color={avgColor}
          sub={`across ${data.events.length} event${data.events.length !== 1 ? 's' : ''}`}
        />
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Total Blocking Time (TBT)"
          value={fmtMs(data.totalBlockingTimeMs)}
          color={tbtColor}
          sub={data.totalBlockingTimeMs > 300 ? 'High — long tasks block main thread' : 'Main thread health'}
        />
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <div ref={wrapRef} className="relative w-full rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Event Handler Timeline</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 rounded-sm" style={{ background: 'rgba(239,68,68,0.22)', border: '1px solid rgba(239,68,68,0.4)' }} />
              Long Task (click to zoom FlameChart)
            </span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> &lt;100ms</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> 100–300ms</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> &gt;300ms</span>
          </div>
        </div>
        <svg ref={svgRef} className="block w-full" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute hidden rounded-md px-3 py-2.5 text-sm shadow-xl z-10"
          style={{
            background:    'rgba(9,9,11,0.94)',
            border:        '1px solid #52525b',
            backdropFilter:'blur(6px)',
            minWidth:      180,
          }}
        />
      </div>

      {/* ── Detail Panel ──────────────────────────────────────────────────── */}
      {selected && (
        <Card className="border-border" style={{ borderColor: interactionColor(selected.totalDurationMs) + '40' }}>
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-4 flex-1 min-w-0">

                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: interactionBg(selected.totalDurationMs), color: interactionColor(selected.totalDurationMs) }}>
                    {capitalize(selected.type)}
                  </span>
                  {selected.isUserInput && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">User Input</span>
                  )}
                  {selected.isINP && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">INP</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">@ {fmtMs(selected.startMs)}</span>
                </div>

                <StackedBar ev={selected} />

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Input Delay',   ms: selected.inputDelayMs,        color: '#f97316' },
                    { label: 'Processing',    ms: selected.processingTimeMs,    color: '#a855f7' },
                    { label: 'Presentation',  ms: selected.presentationDelayMs, color: '#3b82f6' },
                    { label: 'Total',         ms: selected.totalDurationMs,     color: interactionColor(selected.totalDurationMs) },
                  ].map(({ label, ms, color }) => (
                    <div key={label} className="rounded-md bg-muted/40 px-2 py-2">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color }}>{fmtMs(ms)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 text-xs">
                  <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Target: </span>
                    <code className="font-mono text-cyan-400 bg-cyan-950/30 px-1 rounded">{selected.targetElement}</code>
                  </div>
                </div>

                {selected.blockingFunctionName ? (
                  <div className="flex items-start gap-2 text-xs">
                    <Code2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Blocking script: </span>
                      <code className="font-mono text-amber-400 bg-amber-950/30 px-1 rounded break-all">{selected.blockingFunctionName}</code>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Code2 className="w-3.5 h-3.5 shrink-0" />
                    <span>No blocking function identified within this event</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" variant="outline" className="text-xs gap-1.5 whitespace-nowrap"
                  onClick={() => seekToFlameChart(selected)}>
                  <Zap className="w-3 h-3" />
                  View in FlameChart
                </Button>
                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground"
                  onClick={() => setSelectedId(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
