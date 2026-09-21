import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HistoryEntry } from '@/entities/history';
import { hasResult } from '@/entities/history';
import { getHostname } from '@/entities/website';
import { scoreBand, BAND_BAR } from '@/entities/analysis';
import { InstrumentField, Readout } from '@/shared/ui/instrument';

/** Ticks are placed by time, so the tape needs a window. Four weeks is the span the page's
 *  other numbers are usually read over, and it is long enough that a daily schedule draws
 *  a rhythm rather than a blur. */
const WINDOW_DAYS = 28;
const DAY = 86_400_000;

/** One colour per lane, cycling. Identity, not verdict — the ticks carry the verdict, and
 *  these only have to tell six rows apart at a glance. */
const LANE_COLOURS = [
  'var(--ld-accent)',
  'var(--ld-teal)',
  'var(--ld-amber)',
  'var(--ld-accent-2)',
  'var(--ld-rose)',
  'var(--ld-border-strong)',
];

interface Row { host: string; url: string; runs: { at: number; score: number; id: string }[] }

/**
 * Every audit in the account as a tick on one time axis, one lane per site.
 *
 * The page's other blocks each answer a question about a *site*. Nothing answered the
 * question you actually arrive with — what has been measured lately, and did anything
 * fall over — and a list of cards cannot: the reader has to open six of them and hold
 * the dates in their head.
 *
 * A tick is coloured by its band, so a lane that turns red is visible before anything is
 * read, and gaps are information too: a nightly schedule that stopped running is a row of
 * ticks that simply stops.
 */
export function RunTape({ entries }: { entries: HistoryEntry[] }) {
  // Read once, in an initialiser rather than during render: the window has to be the same
  // on every re-render, or a tick's position drifts by a few pixels each time the list
  // around it changes.
  const [now] = useState(() => Date.now());
  const from = now - WINDOW_DAYS * DAY;

  const { rows, total, worst } = useMemo(() => {
    const byHost = new Map<string, Row>();
    let count = 0;
    let lowest: { score: number; host: string } | null = null;

    for (const e of entries) {
      if (!hasResult(e)) continue;
      const at = new Date(e.timestamp).getTime();
      if (at < from) continue;
      const host = getHostname(e.url, '');
      if (!host) continue;

      const row = byHost.get(host) ?? { host, url: e.url, runs: [] };
      const score = Math.round(e.scores.performance);
      row.runs.push({ at, score, id: e.id });
      byHost.set(host, row);
      count++;
      if (!lowest || score < lowest.score) lowest = { score, host };
    }

    const list = [...byHost.values()]
      .map(r => ({ ...r, runs: r.runs.sort((a, b) => a.at - b.at) }))
      // Busiest lane first: the site under active work is the one being read about.
      .sort((a, b) => b.runs.length - a.runs.length)
      .slice(0, 6);

    return { rows: list, total: count, worst: lowest };
  }, [entries, from]);

  // Nothing in the window is not an empty state — the page below still has years of runs
  // to show. The tape simply has nothing to draw, so it draws nothing.
  if (!rows.length) return null;

  const at = (ms: number) => `${Math.max(0, Math.min(100, ((ms - from) / (now - from)) * 100))}%`;

  return (
    <InstrumentField>
      <div className="flex items-stretch max-[820px]:flex-col">
        {/* The lanes. Left column names the site, right column is the axis it is
            measured on — the same axis for every lane, which is the entire point. */}
        <div className="flex-1 min-w-0 px-[20px] py-[18px]">
          <div className="flex items-baseline justify-between gap-3 mb-[14px]">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[.18em] text-ld-text-3">
              Runs · last {WINDOW_DAYS} days
            </h2>
            <span className="font-mono text-[10.5px] text-ld-text-3 tabular-nums">
              {new Date(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {' → today'}
            </span>
          </div>

          <div className="relative flex flex-col">
            {/* Today. Every tick is read as a distance from this edge, so the edge is
                drawn rather than implied. */}
            <span
              aria-hidden
              className="absolute right-[8px] top-0 bottom-[2px] w-px bg-ld-accent-line"
            />
            {rows.map((row, i) => (
              <div
                key={row.host}
                // Zebra, faintly: six lanes of identical hairline read as one hatched
                // block, and following a single site across the axis meant using a finger.
                className={`group flex items-center gap-[12px] min-w-0 rounded-[8px] px-[8px] py-[5px]
                            transition-colors duration-150 hover:bg-ld-surface-hover
                            ${i % 2 === 1 ? 'bg-ld-surface-2/60' : ''}`}
              >
                <Link
                  to={`/history?url=${encodeURIComponent(row.url)}`}
                  className="w-[150px] max-sm:w-[104px] shrink-0 flex items-center gap-[7px] min-w-0 font-mono text-[12px] text-ld-text-2 hover:text-ld-accent transition-colors"
                  title={row.host}
                >
                  {/* The lane's colour, so the tick colours below read as verdicts rather
                      than as the site's identity. */}
                  <span
                    aria-hidden
                    className="w-[6px] h-[6px] rounded-full shrink-0"
                    style={{ background: LANE_COLOURS[i % LANE_COLOURS.length] }}
                  />
                  <span className="truncate">{row.host}</span>
                </Link>

                <div className="relative flex-1 h-[22px] min-w-0">
                  {/* The lane's own rule, so an empty stretch reads as measured silence
                      rather than as a missing row. It fades in from the left: the window
                      starts four weeks ago, and a hard edge there reads as data. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2
                               bg-[linear-gradient(90deg,transparent,var(--ld-border)_12%,var(--ld-border))]"
                  />
                  {row.runs.map(run => (
                    <span
                      key={run.id}
                      title={`${row.host} · ${run.score} · ${new Date(run.at).toLocaleString()}`}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] rounded-full ${BAND_BAR[scoreBand(run.score)]}`}
                      // Taller for a worse run: the tape's shape carries the bad news, and
                      // colour alone would not reach a reader who cannot separate the two.
                      style={{ left: at(run.at), height: `${10 + (100 - run.score) * 0.12}px` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What the tape adds up to. Two readings, not four — the lanes are the content. */}
        <div className="grid grid-cols-2 border-l border-ld-border shrink-0 w-[300px]
                        max-[820px]:w-full max-[820px]:border-l-0 max-[820px]:border-t">
          <Readout label="Runs" value={total} tone="teal" tint sub={`${rows.length} ${rows.length === 1 ? 'site' : 'sites'}`} />
          <Readout
            label="Worst run"
            value={worst ? worst.score : '—'}
            tone={worst ? scoreBand(worst.score) : 'neutral'}
            tint={!!worst && scoreBand(worst.score) !== 'good'}
            sub={worst?.host}
            className="border-l border-ld-border"
          />
        </div>
      </div>
    </InstrumentField>
  );
}
