/**
 * InteractionTimeline — FID/INP responsiveness panel.
 * Panel chrome + alert banners + 3 INP stat cards + D3 event timeline.
 */

import { useEffect, useRef, useState, useMemo, memo } from 'react';
import * as d3 from 'd3';
import {
  Zap, Clock, BarChart3, AlertTriangle, CircleAlert,
  MousePointerClick, Code2,
} from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { useTimelineContext } from '../model/TimelineContext';
import type { InteractionData, InteractionEvent, LongTaskSegment } from '@/entities/analysis';

// ─── Layout ───────────────────────────────────────────────────────────────────

const MARGIN   = { top: 28, right: 24, bottom: 48, left: 60 };
const CHART_H  = 210;
const PIN_LINE = 54;
const CIRCLE_R = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inpSeverity(ms: number): 'ok' | 'warn' | 'poor' {
  if (ms < 100) return 'ok';
  if (ms < 300) return 'warn';
  return 'poor';
}

function tbtSeverity(ms: number): 'ok' | 'warn' | 'poor' {
  if (ms <= 200) return 'ok';
  if (ms <= 600) return 'warn';
  return 'poor';
}

function severityClass(s: 'ok' | 'warn' | 'poor'): string {
  if (s === 'poor') return 'text-ld-rose';
  if (s === 'warn') return 'text-ld-amber';
  return 'text-[var(--ld-accent-2)]';
}

function ratingLabel(ms: number): string {
  if (ms < 100) return 'Fast';
  if (ms < 300) return 'Needs work';
  return 'Slow';
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max = 14): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── INP stat card ────────────────────────────────────────────────────────────

function InpStatCard({ icon, label, value, sub, severity }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  severity: 'ok' | 'warn' | 'poor';
}) {
  return (
    <div className="rounded-[14px] border border-ld-border bg-ld-surface-2 px-[18px] py-[16px]">
      <div className="flex items-center gap-[8px] text-[12.5px] font-medium text-ld-text-2 [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:text-ld-text-3">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn(
        'font-mono font-semibold text-[26px] leading-none tabular-nums mt-[8px] tracking-[-0.02em]',
        severityClass(severity),
      )}>
        {value}
      </p>
      <p className="text-[12px] text-ld-text-3 mt-[3px]">{sub}</p>
    </div>
  );
}

// ─── Stacked bar (selected detail) ───────────────────────────────────────────

function StackedBar({ ev }: { ev: InteractionEvent }) {
  const total = ev.totalDurationMs || 1;
  const segs = [
    { label: 'Input Delay',  ms: ev.inputDelayMs,        cls: 'bg-ld-amber'  },
    { label: 'Processing',   ms: ev.processingTimeMs,    cls: 'bg-[#a855f7]' },
    { label: 'Presentation', ms: ev.presentationDelayMs, cls: 'bg-[#3b82f6]' },
  ];
  return (
    <div className="space-y-[6px]">
      <div className="flex h-[10px] rounded-full overflow-hidden w-full">
        {segs.map(s => (
          <div
            key={s.label}
            className={s.cls}
            style={{ width: `${(s.ms / total) * 100}%` }}
            title={`${s.label}: ${fmtMs(s.ms)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-[14px] gap-y-[2px]">
        {segs.map(s => (
          <div key={s.label} className="flex items-center gap-[6px] text-[10px]">
            <span className={cn('w-[7px] h-[7px] rounded-sm shrink-0', s.cls)} />
            <span className="text-ld-text-3">{s.label}</span>
            <span className="font-mono font-medium text-ld-text">{fmtMs(s.ms)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const InteractionTimeline = memo(function InteractionTimeline({
  data,
}: {
  data: InteractionData;
}) {
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

    // Read CSS design tokens at render time so chart respects theme
    const cs = getComputedStyle(document.documentElement);
    const C = {
      accent:       cs.getPropertyValue('--ld-accent').trim()        || '#14c08a',
      amber:        cs.getPropertyValue('--ld-amber').trim()         || '#e6a23c',
      rose:         cs.getPropertyValue('--ld-rose').trim()          || '#f2647a',
      text3:        cs.getPropertyValue('--ld-text-3').trim()        || '#6f8278',
      border:       cs.getPropertyValue('--ld-border').trim()        || 'rgba(180,230,205,0.09)',
      borderStrong: cs.getPropertyValue('--ld-border-strong').trim() || 'rgba(180,230,205,0.16)',
    };

    const intColor = (ms: number) => ms < 100 ? C.accent : ms < 300 ? C.amber : C.rose;

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
        .attr('stroke', C.border)
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
      .attr('fill',         'rgba(242,100,122,0.07)')
      .attr('stroke',       'rgba(242,100,122,0.18)')
      .attr('stroke-width', 0.5);

    zoneG.filter(lt => xScale(lt.startMs + lt.durationMs) - xScale(lt.startMs) > 46)
      .append('text')
      .attr('x', lt => xScale(lt.startMs) + 4).attr('y', 9)
      .attr('fill', C.rose).attr('fill-opacity', 0.55)
      .attr('font-size', '8px').text('Long Task');

    zoneG
      .on('mouseenter', function(event: MouseEvent, lt: LongTaskSegment) {
        d3.select(this).select<SVGRectElement>('.blocking-rect')
          .attr('fill', 'rgba(242,100,122,0.20)')
          .attr('stroke', 'rgba(242,100,122,0.45)');
        tip.style.display = 'block';
        tip.style.left    = `${Math.min(event.clientX + 14, window.innerWidth - 220)}px`;
        tip.style.top     = `${Math.max(event.clientY - 70, 4)}px`;
        tip.innerHTML = `
          <div style="font-size:11px;font-weight:700;color:${C.rose};margin-bottom:4px">
            Long Task: ${fmtMs(lt.durationMs)}
          </div>
          <div style="font-size:10px;color:${C.text3};line-height:1.8">
            Start: ${fmtMs(lt.startMs)}<br/>
            ${lt.topFunctionName
              ? `Top fn: <span style="color:${C.amber};font-family:monospace">${lt.topFunctionName}</span>`
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
          .attr('fill',   'rgba(242,100,122,0.07)')
          .attr('stroke', 'rgba(242,100,122,0.18)');
        tip.style.display = 'none';
      })
      .on('click', (_: MouseEvent, lt: LongTaskSegment) => {
        ctx?.zoomFnRef.current?.(lt.startMs, lt.startMs + lt.durationMs);
      });

    // ── X axis ────────────────────────────────────────────────────────────────

    g.append('g')
      .attr('transform', `translate(0, ${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => fmtMs(Number(d))))
      .call(ax => ax.select('.domain').attr('stroke', C.borderStrong))
      .call(ax => ax.selectAll('text').attr('fill', C.text3).attr('font-size', '10px'))
      .call(ax => ax.selectAll('.tick line').attr('stroke', C.border));

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', C.text3).attr('fill-opacity', 0.6).attr('font-size', '9px')
      .text('Time from navigation start');

    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', innerH).attr('y2', innerH)
      .attr('stroke', C.borderStrong);

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
        .attr('fill', C.rose).text('INP');

      pinG.append('circle')
        .attr('class', 'selected-ring')
        .attr('cy', circleY).attr('r', CIRCLE_R + 5)
        .attr('fill', 'none')
        .attr('stroke', ev => intColor(ev.totalDurationMs))
        .attr('stroke-width', 2)
        .attr('opacity', ev => ev.id === selectedId ? 1 : 0);

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
        .attr('font-size', '7.5px').attr('fill', C.text3)
        .text(ev => truncate(ev.targetElement.toLowerCase(), 14));

      pinG
        .on('mouseenter', function(event: MouseEvent, ev: InteractionEvent) {
          d3.select<SVGGElement, InteractionEvent>(this).select('.selected-ring').attr('opacity', 0.7);
          const col = intColor(ev.totalDurationMs);
          tip.style.display = 'block';
          tip.style.left    = `${Math.min(event.clientX + 14, window.innerWidth - 200)}px`;
          tip.style.top     = `${Math.max(event.clientY - 90, 4)}px`;
          tip.innerHTML = `
            <div style="font-size:10px;color:${C.text3};margin-bottom:4px">
              ${capitalize(ev.type)} · ${fmtMs(ev.startMs)}
            </div>
            <div style="font-size:13px;font-weight:700;color:${col};margin-bottom:6px">
              ${fmtMs(ev.totalDurationMs)} <span style="font-size:10px;font-weight:400">${ratingLabel(ev.totalDurationMs)}</span>
            </div>
            <div style="font-size:10px;color:${C.text3};line-height:1.7">
              <span style="color:${C.amber}">■</span> Input Delay&nbsp;&nbsp;&nbsp;${fmtMs(ev.inputDelayMs)}<br/>
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
      <Panel>
        <PanelHeader icon={<MousePointerClick />} title="Interaction Responsiveness" meta="FID / INP" />
        <div className="flex flex-col items-center justify-center py-[48px] gap-[8px]">
          <MousePointerClick className="w-[32px] h-[32px] text-ld-text-3 opacity-30" />
          <p className="text-[13px] text-ld-text-3">No interaction events detected in this trace.</p>
          <p className="text-[11px] text-ld-text-3 opacity-60">
            EventDispatch events were not captured during the Lighthouse run.
          </p>
        </div>
      </Panel>
    );
  }

  const inpSev = inpSeverity(data.inpMs);
  const avgSev = inpSeverity(data.avgInputDelayMs);
  const tbtSev = tbtSeverity(data.totalBlockingTimeMs);

  const showWarnBanner = data.totalBlockingTimeMs > 500;
  const showCritBanner = data.inpMs > 200;

  const selSevCls = selected ? severityClass(inpSeverity(selected.totalDurationMs)) : '';
  const selBadgeCls = selected
    ? (selected.totalDurationMs < 100
        ? 'text-[var(--ld-accent-2)] bg-ld-accent-soft border-ld-accent-line'
        : selected.totalDurationMs < 300
        ? 'text-ld-amber bg-[rgba(230,162,60,.1)] border-[rgba(230,162,60,.25)]'
        : 'text-ld-rose bg-[rgba(242,100,122,.1)] border-[rgba(242,100,122,.25)]')
    : '';

  return (
    <>
      <Panel>
        <PanelHeader icon={<MousePointerClick />} title="Interaction Responsiveness" meta="FID / INP" />

        {/* ── Alert banners ───────────────────────────────────────────────── */}
        {(showWarnBanner || showCritBanner) && (
          <div className="px-[18px] pt-[14px] space-y-[8px]">
            {showWarnBanner && (
              <div className="flex items-center gap-[11px] px-[15px] py-[13px] rounded-[12px] text-[13.5px] font-medium text-ld-amber bg-[rgba(230,162,60,.08)] border border-[rgba(230,162,60,.25)]">
                <AlertTriangle className="w-[18px] h-[18px] shrink-0" />
                <span>High main-thread blocking detected — the UI may feel laggy during load.</span>
              </div>
            )}
            {showCritBanner && (
              <div className="flex items-center gap-[11px] px-[15px] py-[13px] rounded-[12px] text-[13.5px] font-medium text-ld-rose bg-[rgba(242,100,122,.07)] border border-[rgba(242,100,122,.25)]">
                <CircleAlert className="w-[18px] h-[18px] shrink-0" />
                <span>Critical interaction delay found — user clicks are being held up by long tasks.</span>
              </div>
            )}
          </div>
        )}

        {/* ── INP stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 max-[760px]:grid-cols-1 gap-[14px] px-[18px] py-[16px]">
          <InpStatCard
            icon={<Zap />}
            label="Max Interaction Delay (INP)"
            value={fmtMs(data.inpMs)}
            sub={ratingLabel(data.inpMs)}
            severity={inpSev}
          />
          <InpStatCard
            icon={<Clock />}
            label="Average Input Delay"
            value={fmtMs(data.avgInputDelayMs)}
            sub={`across ${data.events.length} event${data.events.length !== 1 ? 's' : ''}`}
            severity={avgSev}
          />
          <InpStatCard
            icon={<BarChart3 />}
            label="Total Blocking Time"
            value={fmtMs(data.totalBlockingTimeMs)}
            sub={data.totalBlockingTimeMs > 300 ? 'long tasks block main thread' : 'main thread health'}
            severity={tbtSev}
          />
        </div>

        {/* ── D3 timeline ─────────────────────────────────────────────────── */}
        <div className="px-[18px] pb-[18px]">
          <div
            ref={wrapRef}
            className="rounded-[12px] border border-ld-border bg-ld-bg-2 relative overflow-hidden"
          >
            {/* Legend */}
            <div className="flex items-center gap-[14px] px-[14px] pt-[14px] pb-[8px] flex-wrap">
              {[
                { label: 'Long Task', cls: 'bg-[rgba(242,100,122,.4)] rounded-[2px]' },
                { label: '<100ms',    cls: 'bg-ld-accent rounded-full'               },
                { label: '100–300ms', cls: 'bg-ld-amber rounded-full'                },
                { label: '>300ms',    cls: 'bg-ld-rose rounded-full'                 },
              ].map(({ label, cls }) => (
                <span key={label} className="inline-flex items-center gap-[6px] font-mono text-[10.5px] text-ld-text-3">
                  <span className={cn('block w-[9px] h-[9px]', cls)} />
                  {label}
                </span>
              ))}
              <span className="ml-auto font-mono text-[9.5px] text-ld-text-3 opacity-60 italic">
                Click zone → zoom FlameChart
              </span>
            </div>

            <svg ref={svgRef} className="block w-full" />
          </div>
        </div>

        {/* ── Selected detail panel ───────────────────────────────────────── */}
        {selected && (
          <div
            className="mx-[18px] mb-[18px] rounded-[14px] border px-[18px] py-[16px]"
            style={{
              borderColor: selected.totalDurationMs < 100
                ? 'var(--ld-accent-line)'
                : selected.totalDurationMs < 300
                ? 'rgba(230,162,60,.3)'
                : 'rgba(242,100,122,.3)',
            }}
          >
            <div className="flex items-start justify-between gap-[16px]">
              <div className="space-y-[14px] flex-1 min-w-0">

                {/* Badges */}
                <div className="flex items-center flex-wrap gap-[6px]">
                  <span className={cn('text-[11px] font-semibold px-[8px] py-[2px] rounded-full border', selBadgeCls)}>
                    {capitalize(selected.type)}
                  </span>
                  {selected.isUserInput && (
                    <span className="text-[11px] font-semibold px-[8px] py-[2px] rounded-full bg-[rgba(59,130,246,.12)] text-[#3b82f6] border border-[rgba(59,130,246,.25)]">
                      User Input
                    </span>
                  )}
                  {selected.isINP && (
                    <span className="text-[11px] font-semibold px-[8px] py-[2px] rounded-full text-ld-rose bg-[rgba(242,100,122,.1)] border border-[rgba(242,100,122,.25)]">
                      INP
                    </span>
                  )}
                  <span className="text-[11px] text-ld-text-3 ml-auto">@ {fmtMs(selected.startMs)}</span>
                </div>

                <StackedBar ev={selected} />

                {/* 4-cell timing grid */}
                <div className="grid grid-cols-4 gap-[8px] text-center">
                  {[
                    { label: 'Input Delay',  ms: selected.inputDelayMs,        cls: 'text-ld-amber'  },
                    { label: 'Processing',   ms: selected.processingTimeMs,    cls: 'text-[#a855f7]' },
                    { label: 'Presentation', ms: selected.presentationDelayMs, cls: 'text-[#3b82f6]' },
                    { label: 'Total',        ms: selected.totalDurationMs,     cls: selSevCls        },
                  ].map(({ label, ms, cls }) => (
                    <div key={label} className="rounded-[10px] bg-ld-surface-2 border border-ld-border px-[8px] py-[8px]">
                      <p className="text-[10px] text-ld-text-3">{label}</p>
                      <p className={cn('font-mono text-[13px] font-semibold mt-[2px]', cls)}>{fmtMs(ms)}</p>
                    </div>
                  ))}
                </div>

                {/* Target element */}
                <div className="flex items-start gap-[8px] text-[12px]">
                  <MousePointerClick className="w-[13px] h-[13px] text-ld-text-3 mt-[1px] shrink-0" />
                  <div>
                    <span className="text-ld-text-3">Target: </span>
                    <code className="font-mono text-[11px] text-[var(--ld-accent-2)] bg-ld-accent-soft px-[4px] py-[1px] rounded-[4px]">
                      {selected.targetElement}
                    </code>
                  </div>
                </div>

                {/* Blocking function */}
                {selected.blockingFunctionName ? (
                  <div className="flex items-start gap-[8px] text-[12px]">
                    <Code2 className="w-[13px] h-[13px] text-ld-text-3 mt-[1px] shrink-0" />
                    <div>
                      <span className="text-ld-text-3">Blocking script: </span>
                      <code className="font-mono text-[11px] text-ld-amber bg-[rgba(230,162,60,.1)] px-[4px] py-[1px] rounded-[4px] break-all">
                        {selected.blockingFunctionName}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-[8px] text-[12px] text-ld-text-3">
                    <Code2 className="w-[13px] h-[13px] shrink-0" />
                    <span>No blocking function identified within this event</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-[8px] shrink-0">
                <Button
                  size="sm" variant="outline"
                  className="text-[11px] gap-[6px] whitespace-nowrap"
                  onClick={() => seekToFlameChart(selected)}
                >
                  <Zap className="w-[11px] h-[11px]" />
                  View in FlameChart
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="text-[11px] text-ld-text-3"
                  onClick={() => setSelectedId(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Fixed tooltip — escapes Panel overflow */}
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[200] hidden rounded-[10px] border border-ld-border bg-ld-surface shadow-ld-shadow-card px-[12px] py-[10px] text-[12px] text-ld-text-2 min-w-[180px]"
      />
    </>
  );
});
