import { useMemo } from 'react';
import { expandSchedule, timeToMinutes, MINUTES_PER_DAY } from '@perfscope/shared';
import type { Website } from '@/entities/website';
import { getHostname } from '@/entities/website';
import { InstrumentField, Readout } from '@/shared/ui/instrument';

/** Every third hour is labelled — twenty-four numerals across a lane is a ruler nobody
 *  reads, and the ticks carry the rest. */
const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

interface Lane { id: string; host: string; enabled: boolean; runs: { at: number; routes: number; time: string }[] }

/** One colour per lane, cycling — which site a tick belongs to, not how it went. */
const LANE_COLOURS = [
  'var(--ld-accent)',
  'var(--ld-teal)',
  'var(--ld-amber)',
  'var(--ld-accent-2)',
  'var(--ld-rose)',
  'var(--ld-border-strong)',
];

/** The quiet hours, drawn behind every lane: 22:00–06:00. A schedule is chosen *against*
 *  this — "run it while nobody is on the site" is the whole reason the page exists — and
 *  a bare axis made the reader count hours to see whether they had. */
const NIGHT = [{ from: 0, to: 6 }, { from: 22, to: 24 }];

/**
 * The day, and what fires in it.
 *
 * This page decides *when* sites are audited and had no picture of when: each card stated
 * its own times in text, so the one question the page exists to answer — is anything piled
 * up on the same minute, and is the night empty — could only be answered by opening every
 * card and doing the arithmetic. One axis, one lane per site, every run a tick on it.
 *
 * The timetable comes from the shared `expandSchedule`, the same function the cron runs,
 * so this cannot show a schedule that differs from the one that fires.
 */
export function DayTimetable({ sites }: { sites: Website[] }) {
  const { lanes, runsPerDay, busiest } = useMemo(() => {
    const list: Lane[] = [];
    let total = 0;

    for (const site of sites) {
      const slots = expandSchedule(site.automation);
      if (!slots.length) continue;

      const runs = slots.flatMap(slot => {
        const at = timeToMinutes(slot.time);
        return at === null ? [] : [{ at, routes: slot.routes.length, time: slot.time }];
      });
      if (!runs.length) continue;

      total += runs.reduce((sum, r) => sum + r.routes, 0);
      list.push({
        id: site._id,
        host: getHostname(site.url),
        enabled: !!site.automation?.enabled,
        runs,
      });
    }

    // Whichever hour carries the most audits — the number the page is really being read
    // for, since everything landing at 03:00 is the failure mode of a spread schedule.
    const perHour = new Array<number>(24).fill(0);
    for (const lane of list) {
      for (const run of lane.runs) perHour[Math.floor(run.at / 60)]! += run.routes;
    }
    const peak = perHour.reduce((best, count, hour) => (count > perHour[best]! ? hour : best), 0);

    return {
      lanes: list,
      runsPerDay: total,
      busiest: perHour[peak]! > 0 ? { hour: peak, count: perHour[peak]! } : null,
    };
  }, [sites]);

  if (!lanes.length) return null;

  return (
    <InstrumentField className="mb-[26px]">
      <div className="flex items-stretch max-[900px]:flex-col">
        <div className="flex-1 min-w-0 px-[20px] py-[18px]">
          <div className="flex items-baseline justify-between gap-3 mb-[14px]">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[.18em] text-ld-text-3">
              The day
            </h2>
            <span className="font-mono text-[10.5px] text-ld-text-3">server time</span>
          </div>

          <div className="flex flex-col">
            {lanes.map((lane, i) => (
              <div
                key={lane.id}
                className={`group flex items-center gap-[12px] min-w-0 rounded-[8px] px-[8px] py-[5px]
                            transition-colors duration-150 hover:bg-ld-surface-hover
                            ${i % 2 === 1 ? 'bg-ld-surface-2/60' : ''}`}
              >
                <span
                  className="w-[150px] max-sm:w-[100px] shrink-0 flex items-center gap-[7px] min-w-0 font-mono text-[12px] text-ld-text-2"
                  title={lane.host}
                >
                  <span
                    aria-hidden
                    className="w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ background: lane.enabled ? LANE_COLOURS[i % LANE_COLOURS.length] : 'var(--ld-border-strong)' }}
                  />
                  <span className="truncate">{lane.host}</span>
                </span>

                <div className="relative flex-1 h-[20px] min-w-0">
                  {NIGHT.map(band => (
                    <span
                      key={band.from}
                      aria-hidden
                      className="absolute inset-y-0 bg-ld-teal-wash"
                      style={{ left: `${(band.from / 24) * 100}%`, width: `${((band.to - band.from) / 24) * 100}%` }}
                    />
                  ))}
                  <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ld-border" />
                  {lane.runs.map(run => (
                    <span
                      key={run.time}
                      title={`${lane.host} · ${run.time} · ${run.routes} route${run.routes === 1 ? '' : 's'}${lane.enabled ? '' : ' (paused)'}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] rounded-full"
                      style={{
                        left: `${(run.at / MINUTES_PER_DAY) * 100}%`,
                        height: `${Math.min(18, 9 + run.routes * 2)}px`,
                        // A paused site keeps its lane — the timetable is still what it
                        // *would* run, and removing it hides the pile-up you came to see —
                        // but it is drawn in the border grey, not in the lane's colour.
                        background: lane.enabled ? LANE_COLOURS[i % LANE_COLOURS.length] : 'var(--ld-border-strong)',
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* The axis, once, under every lane — the lanes share it, which is the point. */}
          <div aria-hidden className="flex items-center gap-[12px] mt-[10px]">
            {/* Names the shaded bands. `--ld-text-3`, not teal: at 9.5px this is small
                text, and teal measures ~3.4:1 on the light theme's white. */}
            <span className="w-[150px] max-sm:w-[100px] shrink-0 flex items-center gap-[6px] font-mono text-[9.5px] uppercase tracking-[.14em] text-ld-text-3">
              <span aria-hidden className="w-[10px] h-[10px] rounded-[3px] bg-ld-teal-soft border border-ld-teal-line" />
              quiet hours
            </span>
            <div className="relative flex-1 h-[14px] font-mono text-[9.5px] text-ld-text-3 tabular-nums">
              {HOUR_LABELS.map(hour => (
                <span
                  key={hour}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  {String(hour).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 shrink-0 w-[300px] border-l border-ld-border
                        max-[900px]:w-full max-[900px]:border-l-0 max-[900px]:border-t">
          <Readout label="Audits a day" value={runsPerDay} tone="accent" tint sub={`${lanes.length} scheduled ${lanes.length === 1 ? 'site' : 'sites'}`} />
          <Readout
            label="Busiest hour"
            value={busiest ? `${String(busiest.hour).padStart(2, '0')}:00` : '—'}
            tone="teal"
            tint={!!busiest}
            sub={busiest ? `${busiest.count} audit${busiest.count === 1 ? '' : 's'}` : undefined}
            className="border-l border-ld-border"
          />
        </div>
      </div>
    </InstrumentField>
  );
}
