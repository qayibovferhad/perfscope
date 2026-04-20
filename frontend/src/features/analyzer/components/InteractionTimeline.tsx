/**
 * InteractionTimeline — Visualizes user interaction responsiveness (FID/INP) from trace data.
 *
 * • Score cards: Max INP, Avg Input Delay, Total Blocking Time
 * • D3 horizontal timeline: each interaction as a ⚡ pin marker
 *   - Green  < 100ms | Orange 100–300ms | Red > 300ms
 * • Side panel on click: target element, blocking function, "View in FlameChart" seek
 */

import { useEffect, useRef, useState, useMemo, memo } from 'react';
import * as d3 from 'd3';
import { Zap, Clock, AlertTriangle, MousePointerClick, Code2, Activity } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useTimelineContext } from '../context/TimelineContext';
import type { InteractionData, InteractionEvent } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN   = { top: 40, right: 24, bottom: 32, left: 60 };
const CHART_H  = 140;
const PIN_LINE = 28;    // height of the vertical pin above axis
const CIRCLE_R = 9;

function interactionColor(ms: number): string {
  if (ms < 100)  return '#22c55e';   // green-500
  if (ms < 300)  return '#f97316';   // orange-500
  return '#ef4444';                  // red-500
}

function interactionBg(ms: number): string {
  if (ms < 100)  return 'rgba(34,197,94,0.12)';
  if (ms < 300)  return 'rgba(249,115,22,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function ratingLabel(ms: number): string {
  if (ms < 100)  return 'Fast';
  if (ms < 300)  return 'Needs work';
  return 'Slow';
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

// ─── Score Card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  sub?: string;
}

function MetricCard({ icon, label, value, color, sub }: MetricCardProps) {
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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: InteractionData;
}

export const InteractionTimeline = memo(function InteractionTimeline({ data }: Props) {
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
    if (!wrap || !svg || !tip || data.events.length === 0) return;

    const totalW = wrap.clientWidth;
    const innerW = totalW - MARGIN.left - MARGIN.right;
    const innerH = CHART_H - MARGIN.top - MARGIN.bottom;

    d3.select(svg).selectAll('*').remove();

    const root = d3.select(svg)
      .attr('width', totalW)
      .attr('height', CHART_H);

    const g = root.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const maxMs = Math.max(...data.events.map(e => e.startMs), 1);
    const xScale = d3.scaleLinear().domain([0, maxMs * 1.05]).range([0, innerW]);

    // Background grid lines
    const ticks = xScale.ticks(6);
    g.selectAll('.grid-line')
      .data(ticks)
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', -MARGIN.top + 8)
      .attr('y2', innerH)
      .attr('stroke', 'rgba(255,255,255,0.05)')
      .attr('stroke-dasharray', '3,4');

    // X axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat(d => fmtMs(Number(d)));

    g.append('g')
      .attr('transform', `translate(0, ${innerH})`)
      .call(xAxis)
      .call(ax => ax.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(ax => ax.selectAll('text').attr('fill', '#71717a').attr('font-size', '10px'))
      .call(ax => ax.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.1)'));

    // Axis label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#52525b')
      .attr('font-size', '9px')
      .text('Time from navigation start');

    // Baseline axis line
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', innerH).attr('y2', innerH)
      .attr('stroke', 'rgba(255,255,255,0.15)');

    // ── Interaction pins ────────────────────────────────────────────────────

    const pinG = g.selectAll('.pin')
      .data(data.events)
      .enter()
      .append('g')
      .attr('class', 'pin')
      .attr('transform', ev => `translate(${xScale(ev.startMs)}, 0)`)
      .style('cursor', 'pointer');

    // Vertical pin line
    pinG.append('line')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', innerH - PIN_LINE)
      .attr('y2', innerH)
      .attr('stroke', ev => interactionColor(ev.totalDurationMs))
      .attr('stroke-width', ev => ev.isINP ? 2 : 1.5)
      .attr('stroke-dasharray', ev => ev.isINP ? undefined : '3,2');

    // Circle marker
    pinG.append('circle')
      .attr('cy', innerH - PIN_LINE)
      .attr('r', ev => ev.isINP ? CIRCLE_R + 2 : CIRCLE_R)
      .attr('fill', ev => interactionColor(ev.totalDurationMs))
      .attr('fill-opacity', ev => ev.isINP ? 0.25 : 0.15)
      .attr('stroke', ev => interactionColor(ev.totalDurationMs))
      .attr('stroke-width', ev => ev.isINP ? 2 : 1.5);

    // ⚡ or • label (⚡ for user input, • for lifecycle)
    pinG.append('text')
      .attr('y', innerH - PIN_LINE + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', ev => ev.isINP ? '12px' : '10px')
      .attr('fill', ev => interactionColor(ev.totalDurationMs))
      .text(ev => ev.isUserInput ? '⚡' : '●');

    // INP crown label
    pinG.filter(ev => ev.isINP)
      .append('text')
      .attr('y', innerH - PIN_LINE - 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .attr('fill', '#ef4444')
      .text('INP');

    // Selected ring
    pinG.append('circle')
      .attr('class', 'selected-ring')
      .attr('cy', innerH - PIN_LINE)
      .attr('r', CIRCLE_R + 5)
      .attr('fill', 'none')
      .attr('stroke', ev => interactionColor(ev.totalDurationMs))
      .attr('stroke-width', 2)
      .attr('opacity', ev => ev.id === selectedId ? 1 : 0);

    // ── Interaction: hover + click ──────────────────────────────────────────

    pinG
      .on('mouseenter', function(event, ev) {
        d3.select(this).select('.selected-ring').attr('opacity', 0.7);

        const rect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
        const x    = event.clientX - rect.left;
        const y    = event.clientY - rect.top;
        const col  = interactionColor(ev.totalDurationMs);

        tip.style.display     = 'block';
        tip.style.left        = `${Math.min(x + 12, totalW - 180)}px`;
        tip.style.top         = `${Math.max(y - 60, 4)}px`;
        tip.style.borderColor = col;
        tip.innerHTML = `
          <div style="font-size:10px;color:#a1a1aa;margin-bottom:2px">${ev.type} · ${fmtMs(ev.startMs)}</div>
          <div style="font-size:13px;font-weight:700;color:${col}">${fmtMs(ev.totalDurationMs)}</div>
          <div style="font-size:10px;color:#a1a1aa;margin-top:2px">${ratingLabel(ev.totalDurationMs)}</div>
        `;
      })
      .on('mouseleave', function(_event, ev) {
        if (ev.id !== selectedId) {
          d3.select(this).select('.selected-ring').attr('opacity', 0);
        }
        tip.style.display = 'none';
      })
      .on('click', (_event, ev) => {
        setSelectedId(prev => prev === ev.id ? null : ev.id);
      });

    // Update ring when selectedId changes — handled by opacity attr above on re-render
  }, [data, selectedId]);

  // ── Sync selected ring when selection changes without full re-render ────────

  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, InteractionEvent>('.selected-ring')
      .attr('opacity', ev => ev.id === selectedId ? 1 : 0);
  }, [selectedId]);

  // ── FlameChart seek ────────────────────────────────────────────────────────

  const seekToFlameChart = (ev: InteractionEvent) => {
    ctx?.motionMs.set(ev.startMs);
  };

  // ── Empty state ────────────────────────────────────────────────────────────

  if (data.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <MousePointerClick className="w-8 h-8 opacity-30" />
        <p className="text-sm">No user interaction events detected in this trace.</p>
        <p className="text-xs opacity-60">EventDispatch events (click, keydown, etc.) were not captured.</p>
      </div>
    );
  }

  const inpColor  = interactionColor(data.inpMs);
  const avgColor  = interactionColor(data.avgInputDelayMs);
  const tbtColor  = data.totalBlockingTimeMs > 600 ? '#ef4444'
    : data.totalBlockingTimeMs > 200 ? '#f97316'
    : '#22c55e';

  return (
    <div className="space-y-4">

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
          sub={`across ${data.events.length} interaction${data.events.length !== 1 ? 's' : ''}`}
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
      <div
        ref={wrapRef}
        className="relative w-full rounded-lg border border-border bg-card overflow-hidden"
      >
        <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Event Handler Timeline</span>
            {data.events.every(e => !e.isUserInput) && (
              <span className="text-[10px] text-muted-foreground/60 italic">
                (page lifecycle events — no real user interactions in this trace)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> &lt;100ms</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> 100–300ms</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> &gt;300ms</span>
          </div>
        </div>
        <svg ref={svgRef} className="block w-full" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute hidden rounded-md px-3 py-2 text-sm shadow-xl z-10"
          style={{
            background: 'rgba(9,9,11,0.92)',
            border: '1px solid #52525b',
            backdropFilter: 'blur(6px)',
            minWidth: 130,
          }}
        />
      </div>

      {/* ── Side Panel ───────────────────────────────────────────────────── */}
      {selected && (
        <Card className="border-border" style={{ borderColor: interactionColor(selected.totalDurationMs) + '40' }}>
          <CardContent className="pt-4 pb-4 px-5">
            <div className="flex items-start justify-between gap-4">

              {/* Left: details */}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: interactionBg(selected.totalDurationMs),
                      color: interactionColor(selected.totalDurationMs),
                    }}
                  >
                    {selected.type}
                  </span>
                  {selected.isUserInput && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                      User Input
                    </span>
                  )}
                  {selected.isINP && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                      INP
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    @ {fmtMs(selected.startMs)}
                  </span>
                </div>

                {/* Timing breakdown */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Input Delay',     value: fmtMs(selected.inputDelayMs)     },
                    { label: 'Processing Time', value: fmtMs(selected.processingTimeMs) },
                    { label: 'Total Duration',  value: fmtMs(selected.totalDurationMs)  },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-md bg-muted/40 px-2 py-2">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Target element */}
                <div className="flex items-start gap-2 text-xs">
                  <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Target element: </span>
                    <code className="font-mono text-cyan-400 bg-cyan-950/30 px-1 rounded">
                      {selected.targetElement}
                    </code>
                  </div>
                </div>

                {/* Blocking function */}
                {selected.blockingFunctionName ? (
                  <div className="flex items-start gap-2 text-xs">
                    <Code2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Blocking script: </span>
                      <code className="font-mono text-amber-400 bg-amber-950/30 px-1 rounded break-all">
                        {selected.blockingFunctionName}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Code2 className="w-3.5 h-3.5 shrink-0" />
                    <span>No specific blocking function identified</span>
                  </div>
                )}
              </div>

              {/* Right: actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5 whitespace-nowrap"
                  onClick={() => seekToFlameChart(selected)}
                >
                  <Zap className="w-3 h-3" />
                  View in FlameChart
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={() => setSelectedId(null)}
                >
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
