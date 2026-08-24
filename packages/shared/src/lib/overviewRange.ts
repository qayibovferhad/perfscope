/**
 * The window the dashboard is asking about.
 *
 * It used to be one of three fixed lengths, which is why the wire only ever carried
 * `days`. A date picker can ask for "the first two weeks of August", so the window is now a
 * pair of calendar days — and `days` survives as the shorthand for "the last N", because it
 * is what the presets produce and what every existing link contains.
 *
 * **Day keys, not timestamps, and UTC.** History buckets its runs by UTC day (see the
 * charts aggregation), so a range expressed in anything else would put a run at 23:50 on
 * one side of a boundary and the chart tick for it on the other. A day key names a calendar
 * day; the picker hands over the day the reader clicked, and nothing converts a zone.
 *
 * Shared because both sides have to agree: the client builds the query and labels the
 * charts from it, the server turns it into a Mongo filter. Two copies of "what does
 * `days=7` mean" is how a card ends up counting a different week from the chart beside it.
 */
import { DEFAULT_OVERVIEW_WINDOW } from '../types/overview.js'

/** A year. Long enough for any real question, short enough to bound the aggregation. */
export const MAX_RANGE_DAYS = 365

const DAY_MS = 86_400_000

/** `YYYY-MM-DD`, and a real date — `2026-02-31` matches the shape and is not a day. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** The UTC day a Date falls in. */
export const dayKeyOf = (date: Date): string => date.toISOString().slice(0, 10)

/** `n` days after a day key (negative to go back). */
export function addDays(day: string, n: number): string {
  return dayKeyOf(new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS))
}

/** Whole days from `from` to `to`, inclusive of both — so a single day is 1, not 0. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS) + 1
}

/** Every day in the range, so a gap in the data is still a gap on the axis. */
export function dayKeysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day)
  return out
}

export interface OverviewRangeInput {
  /** The shorthand: the last N days, ending today. Ignored when `from`/`to` are given. */
  days?: unknown
  from?: unknown
  to?:   unknown
}

export interface OverviewRange {
  from: string
  to:   string
  /** Inclusive day count — what the "last N days" labels read from. */
  days: number
}

/**
 * Turn whatever the client asked for into a range both sides can use.
 *
 * An explicit pair wins; otherwise the shorthand; otherwise the default. Everything is
 * clamped rather than rejected, because these arrive in a URL a person can edit and the
 * useful answer to a nonsensical one is the nearest sensible window, not an error page.
 * The clamps are deliberate about *which* end they move: a too-long range keeps its `to`
 * and pulls `from` forward, because the recent end is the one somebody is looking at.
 */
export function resolveOverviewRange(
  input: OverviewRangeInput = {},
  today: string = dayKeyOf(new Date()),
): OverviewRange {
  if (isDayKey(input.from) && isDayKey(input.to)) {
    // Backwards is a mistake, not a request for nothing — a picker can produce it while
    // the second click is still pending.
    let [from, to] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from]

    // A range that ends in the future asks about days nobody has measured yet.
    if (to > today) to = today
    if (from > to) from = to

    if (daysBetween(from, to) > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1))

    return { from, to, days: daysBetween(from, to) }
  }

  // `Number(null)` is 0 and `Number('')` is 0, so an *absent* window would otherwise clamp
  // to a single day — a dashboard that opened on "today" instead of the last thirty days,
  // which is exactly what it did until a screenshot caught it. Absence is checked before
  // the number is read, never after.
  const absent = input.days === undefined || input.days === null || input.days === ''
  const asked = Number(input.days)
  const days = !absent && Number.isFinite(asked)
    ? Math.min(Math.max(Math.trunc(asked), 1), MAX_RANGE_DAYS)
    : DEFAULT_OVERVIEW_WINDOW

  return { from: addDays(today, -(days - 1)), to: today, days }
}
