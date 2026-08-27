/**
 * InteractionTimeline — FID/INP responsiveness panel.
 *
 * Panel chrome, alert banners, three INP stat cards and the detail block for the selected
 * interaction. The chart itself is `lib/interactionChart.ts`: it is 230 lines of imperative
 * D3 with nothing React about it, and reading either half here meant scrolling past the
 * other.
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
import { fmtMs } from '@/shared/lib/format';
import { useTimelineContext } from '../model/TimelineContext';
import { drawInteractionChart } from '../lib/interactionChart';
import {
  vitalBand, BAND_TEXT, BAND_TILE, BAND_BORDER, BAND_LABEL,
  type ScoreBand,
  type InteractionData, type InteractionEvent,
} from '@/entities/analysis';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── INP stat card ────────────────────────────────────────────────────────────

function InpStatCard({ icon, label, value, sub, band }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  band: ScoreBand;
}) {
  return (
    <div className="rounded-[14px] border border-ld-border bg-ld-surface-2 px-[18px] py-[16px]">
      <div className="flex items-center gap-[8px] text-[12.5px] font-medium text-ld-text-2 [&_svg]:w-[15px] [&_svg]:h-[15px] [&_svg]:text-ld-text-3">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn(
        'font-mono font-semibold text-[26px] leading-none tabular-nums mt-[8px] tracking-[-0.02em]',
        BAND_TEXT[band],
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

  // The selection is read at event time through a ref, so the chart does not need to be
  // redrawn to know about it — the second effect below is what repaints the rings.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg  = svgRef.current;
    const tip  = tooltipRef.current;
    if (!wrap || !svg || !tip) return;

    drawInteractionChart({
      svg, wrap, tip, data,
      getSelectedId: () => selectedIdRef.current,
      onSelect: id => setSelectedId(prev => prev === id ? null : id),
      onZoom:   (from, to) => ctx?.zoomFnRef.current?.(from, to),
    });
  }, [data, ctx]);

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
          <p className="text-[11px] text-ld-text-3">
            EventDispatch events were not captured during the Lighthouse run.
          </p>
        </div>
      </Panel>
    );
  }

  const inpBand = vitalBand('inp', data.inpMs);
  const avgBand = vitalBand('inp', data.avgInputDelayMs);
  const tbtBand = vitalBand('tbt', data.totalBlockingTimeMs);

  const showWarnBanner = data.totalBlockingTimeMs > 500;
  const showCritBanner = data.inpMs > 200;

  const selBand = selected ? vitalBand('inp', selected.totalDurationMs) : 'good';

  return (
    <>
      <Panel>
        <PanelHeader icon={<MousePointerClick />} title="Interaction Responsiveness" meta="FID / INP" />

        {/* ── Alert banners ───────────────────────────────────────────────── */}
        {(showWarnBanner || showCritBanner) && (
          <div className="px-[18px] pt-[14px] space-y-[8px]">
            {showWarnBanner && (
              <div className="flex items-center gap-[11px] px-[15px] py-[13px] rounded-[12px] text-[13.5px] font-medium text-ld-amber bg-ld-amber-wash border border-ld-amber-fill">
                <AlertTriangle className="w-[18px] h-[18px] shrink-0" />
                <span>High main-thread blocking detected — the UI may feel laggy during load.</span>
              </div>
            )}
            {showCritBanner && (
              <div className="flex items-center gap-[11px] px-[15px] py-[13px] rounded-[12px] text-[13.5px] font-medium text-ld-rose bg-ld-rose-wash border border-ld-rose-fill">
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
            sub={BAND_LABEL[inpBand]}
            band={inpBand}
          />
          <InpStatCard
            icon={<Clock />}
            label="Average Input Delay"
            value={fmtMs(data.avgInputDelayMs)}
            sub={`across ${data.events.length} event${data.events.length !== 1 ? 's' : ''}`}
            band={avgBand}
          />
          <InpStatCard
            icon={<BarChart3 />}
            label="Total Blocking Time"
            value={fmtMs(data.totalBlockingTimeMs)}
            sub={data.totalBlockingTimeMs > 300 ? 'long tasks block main thread' : 'main thread health'}
            band={tbtBand}
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
                { label: 'Long Task', cls: 'bg-ld-rose-strong rounded-[2px]' },
                { label: '<100ms',    cls: 'bg-ld-accent rounded-full'               },
                { label: '100–300ms', cls: 'bg-ld-amber rounded-full'                },
                { label: '>300ms',    cls: 'bg-ld-rose rounded-full'                 },
              ].map(({ label, cls }) => (
                <span key={label} className="inline-flex items-center gap-[6px] font-mono text-[10.5px] text-ld-text-3">
                  <span className={cn('block w-[9px] h-[9px]', cls)} />
                  {label}
                </span>
              ))}
              <span className="ml-auto font-mono text-[9.5px] text-ld-text-3 italic">
                Click zone → zoom FlameChart
              </span>
            </div>

            <svg ref={svgRef} className="block w-full" />
          </div>
        </div>

        {/* ── Selected detail panel ───────────────────────────────────────── */}
        {selected && (
          <div className={cn(
            'mx-[18px] mb-[18px] rounded-[14px] border px-[18px] py-[16px]',
            BAND_BORDER[selBand],
          )}>
            <div className="flex items-start justify-between gap-[16px]">
              <div className="space-y-[14px] flex-1 min-w-0">

                {/* Badges */}
                <div className="flex items-center flex-wrap gap-[6px]">
                  <span className={cn('text-[11px] font-semibold px-[8px] py-[2px] rounded-full border', BAND_TILE[selBand])}>
                    {capitalize(selected.type)}
                  </span>
                  {selected.isUserInput && (
                    <span className="text-[11px] font-semibold px-[8px] py-[2px] rounded-full bg-[rgba(59,130,246,.12)] text-[#3b82f6] border border-[rgba(59,130,246,.25)]">
                      User Input
                    </span>
                  )}
                  {selected.isINP && (
                    <span className="text-[11px] font-semibold px-[8px] py-[2px] rounded-full text-ld-rose bg-ld-rose-soft border border-ld-rose-fill">
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
                    { label: 'Total',        ms: selected.totalDurationMs,     cls: BAND_TEXT[selBand] },
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
                      <code className="font-mono text-[11px] text-ld-amber bg-ld-amber-soft px-[4px] py-[1px] rounded-[4px] break-all">
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
