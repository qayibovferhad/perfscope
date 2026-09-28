import { useState } from 'react';
import { Segmented } from '@/shared/ui/segmented';
import { Toggle } from '@/shared/ui/toggle';
import type { AutomationScheduleMode } from '@perfscope/shared';

/**
 * The schedule, in the product's own terms.
 *
 * The three modes are the ones `Website.automation.scheduleMode` accepts and the cron
 * expands; the alert card is the payload a webhook receives. The section used to offer
 * daily/weekdays/weekly and a "daily report email" — neither exists.
 */
const MODES: { value: AutomationScheduleMode; label: string; line: string }[] = [
  { value: 'single', label: 'One time',  line: 'Every route, once, at the time you pick.' },
  { value: 'slots',  label: 'Slots',     line: 'Fixed times through the day — a morning and an evening reading.' },
  { value: 'spread', label: 'Spread',    line: 'Spread across a window, so thirty routes are not audited at once.' },
];

const BULLET_ITEMS = [
  {
    b: 'Three runs, the median kept.',
    txt: 'A scheduled audit is always precise: three isolated loads, the middle one stored — so a nightly regression is a regression.',
    icon: <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 18V9M12 18V5M20 18v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    b: 'Always against yesterday.',
    txt: 'Each stored run is compared with the previous run of the same URL on the same device. Small moves stay quiet; real ones do not.',
    icon: <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3v18M5 7l-3 5 3 3M19 7l3 5-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    b: 'Slack, Discord, a webhook, or email.',
    txt: 'A budget breach is delivered the moment it is recorded, in the shape the target expects. A later clean run clears it on its own.',
    icon: <svg viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/></svg>,
  },
] as const;

const BREACH = [
  { k: 'Performance', v: '71',    limit: 'min 80',    over: true  },
  { k: 'LCP',         v: '3.1 s', limit: 'max 2.5 s', over: true  },
  { k: 'CLS',         v: '0.04',  limit: 'max 0.1',   over: false },
] as const;

function fmtTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
}

export function ScheduledSection() {
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode]       = useState<AutomationScheduleMode>('single');
  const [mins, setMins]       = useState(3 * 60);

  const stepTime = (delta: number) => setMins(prev => (prev + delta + 1440) % 1440);
  const current  = MODES.find(m => m.value === mode)!;
  const summary  = !enabled
    ? 'Schedule paused — manual audits still run'
    : mode === 'single' ? `Next run — tomorrow at ${fmtTime(mins)}, 3 runs per route`
    : mode === 'slots'  ? `Next run — ${fmtTime(mins)}, then again this evening`
    :                     `Next window — opens ${fmtTime(mins)}, routes spread over an hour`;

  return (
    <section className="py-[clamp(72px,11vw,140px)] border-y border-ld-border bg-ld-bg-2" id="schedule">
      <div className="ld-wrap">
        <div className="grid grid-cols-1 min-[980px]:grid-cols-2 gap-[clamp(36px,6vw,76px)] items-center">

          <div className="reveal">
            <span className="ld-eyebrow block mb-4">Schedule</span>
            <h2 className="ld-h-section text-ld-text">Audited overnight.<br />Told in the morning.</h2>
            <p className="ld-lead mt-5">
              Pick the routes and a time once. PerfScope audits them on its own, files every
              result in history, and only speaks up when a budget is missed.
            </p>
            <ul className="grid gap-[18px] mt-[30px] list-none p-0">
              {BULLET_ITEMS.map(({ icon, b, txt }) => (
                <li key={b} className="flex gap-[14px] items-start">
                  <span className="w-[38px] h-[38px] shrink-0 rounded-[10px] grid place-items-center border border-ld-border-strong bg-ld-surface-2 text-ld-accent [&>svg]:w-[18px] [&>svg]:h-[18px]">
                    {icon}
                  </span>
                  <div className="text-[14.5px] text-ld-text-2 leading-[1.5]">
                    <b className="text-ld-text font-semibold">{b}</b> {txt}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal grid gap-4">
            {/* The schedule editor, as the automation page draws it */}
            <div className="rounded-[18px] border border-ld-border-strong bg-ld-surface p-[22px] shadow-ld-shadow-card">
              <div className="flex items-center justify-between mb-5">
                <span className="font-mono text-[13px] text-ld-text-2 tracking-[.04em]">Audit schedule · 4 routes</span>
                <Toggle enabled={enabled} onChange={setEnabled} label="Scheduled audits (demo)" />
              </div>

              <div className="flex items-center justify-between gap-[14px] py-[13px] border-t border-ld-border">
                <span className="font-mono text-[11px] tracking-[.1em] text-ld-text-3">MODE</span>
                <Segmented
                  ariaLabel="Schedule mode"
                  value={mode}
                  onChange={setMode}
                  options={MODES.map(m => ({ value: m.value, label: m.label }))}
                />
              </div>
              <p className="text-[12.5px] text-ld-text-3 m-0 -mt-1 pb-3">{current.line}</p>

              <div className="flex items-center justify-between gap-[14px] py-[13px] border-t border-ld-border">
                <span className="font-mono text-[11px] tracking-[.1em] text-ld-text-3">{mode === 'spread' ? 'WINDOW OPENS' : 'TIME'}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => stepTime(-30)} aria-label="Earlier" className="w-8 h-8 rounded-[8px] border border-ld-border bg-ld-surface-2 text-ld-text-2 text-[18px] leading-none hover:border-ld-accent-line">−</button>
                  <span className="font-mono text-[17px] font-semibold text-ld-text min-w-[56px] text-center tabular-nums">{fmtTime(mins)}</span>
                  <button type="button" onClick={() => stepTime(30)} aria-label="Later" className="w-8 h-8 rounded-[8px] border border-ld-border bg-ld-surface-2 text-ld-text-2 text-[18px] leading-none hover:border-ld-accent-line">+</button>
                  <span className="font-mono text-[11px] text-ld-text-3 px-[7px] py-[3px] rounded-md border border-ld-border">local</span>
                </div>
              </div>

              <div className={`mt-2 px-[14px] py-[11px] rounded-[10px] border font-mono text-[12.5px] ${enabled ? 'border-ld-accent-line bg-ld-accent-wash text-ld-accent-2' : 'border-ld-border bg-ld-surface-2 text-ld-text-3'}`}>
                <span className={`inline-block w-[7px] h-[7px] rounded-full mr-2 align-middle ${enabled ? 'bg-ld-accent ld-pulse' : 'bg-ld-border-strong'}`} />
                {summary}
              </div>
            </div>

            {/* The breach, as a webhook receives it */}
            <div className="rounded-[18px] border border-ld-border bg-ld-surface overflow-hidden">
              <div className="flex items-center justify-between px-[18px] py-[12px] border-b border-ld-border bg-ld-surface-2">
                <span className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-ld-text">
                  <span className="w-[22px] h-[22px] rounded-[6px] grid place-items-center bg-ld-grad text-ld-grad-text font-mono text-[11px] font-bold">P</span>
                  Budget breach · example.com
                </span>
                <span className="font-mono text-[11px] text-ld-text-3">03:04</span>
              </div>
              <div className="px-[18px] py-[6px]">
                {BREACH.map(({ k, v, limit, over }) => (
                  <div key={k} className="flex items-center justify-between py-[9px] border-b border-ld-border last:border-b-0 text-[13.5px]">
                    <span className="text-ld-text-2">{k}</span>
                    <span className="flex items-baseline gap-[10px]">
                      <b className={`font-mono font-semibold ${over ? 'text-ld-rose' : 'text-ld-accent-2'}`}>{v}</b>
                      <span className="font-mono text-[11.5px] text-ld-text-3">{limit}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="px-[18px] py-[10px] border-t border-ld-border font-mono text-[11.5px] text-ld-text-3 m-0">
                Sent to hooks.slack.com · cleared when the next run passes
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
