import type { AutomationSlot, WebsiteAutomation } from '../types/website.js'

/**
 * Turns an automation config into the timetable it actually runs.
 *
 * The cron and the setup modal both need this answer, and they must not each carry their
 * own version of it: a preview that disagrees with the scheduler is worse than no preview,
 * because it is believed. Everything here is pure — the cron passes the current minute in.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const MINUTES_PER_DAY = 24 * 60

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time)
}

/** 'HH:MM' → minutes since midnight. Returns null for anything malformed. */
export function timeToMinutes(time: string): number | null {
  if (!isValidTime(time)) return null
  const [hh, mm] = time.split(':')
  return Number(hh) * 60 + Number(mm)
}

/** Minutes since midnight → 'HH:MM', wrapping past midnight rather than overflowing. */
export function minutesToTime(minutes: number): string {
  const m  = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Collapses entries sharing a minute into one, de-duping routes and keeping first-seen
 *  order within a slot. Two slots on the same minute would otherwise fire twice. */
function mergeByTime(entries: AutomationSlot[]): AutomationSlot[] {
  const byTime = new Map<string, string[]>()

  for (const entry of entries) {
    if (!isValidTime(entry.time)) continue
    const routes = entry.routes.filter(r => typeof r === 'string' && r.length > 0)
    if (routes.length === 0) continue

    const existing = byTime.get(entry.time)
    if (existing) existing.push(...routes)
    else byTime.set(entry.time, [...routes])
  }

  return [...byTime.entries()]
    .map(([time, routes]) => ({ time, routes: [...new Set(routes)] }))
    .sort((a, b) => a.time.localeCompare(b.time))
}

/**
 * What a timetable is computed from: an automation config without `lastRunAt`.
 *
 * That one field is excluded because the schedule never reads it and the two sides of the
 * wire disagree about its type — the backend model holds a Date, this package a string.
 * Demanding the whole document would make every server-side caller launder a field the
 * timetable does not use.
 */
export type ScheduleSpec = Partial<Omit<WebsiteAutomation, 'lastRunAt'>>

/**
 * Every (time, routes) pair this automation fires in a day, sorted, same-minute entries
 * merged. An empty result means nothing will ever run — which is what the UI warns about.
 */
export function expandSchedule(automation: ScheduleSpec | null | undefined): AutomationSlot[] {
  if (!automation) return []

  const routes = (automation.routes ?? []).filter(r => typeof r === 'string' && r.length > 0)
  const start  = automation.scheduleTime ?? '00:00'
  const mode   = automation.scheduleMode ?? 'single'

  if (mode === 'slots') {
    // Only routes the site still has: removing a route from the site should not leave a
    // slot quietly auditing a URL that is no longer configured.
    const known = new Set(routes)
    return mergeByTime(
      (automation.slots ?? []).map(slot => ({
        time:   slot.time,
        routes: (slot.routes ?? []).filter(r => known.has(r)),
      })),
    )
  }

  if (mode === 'spread') {
    if (routes.length === 0) return []

    const startMin = timeToMinutes(start)
    if (startMin === null) return []

    const window = clampSpreadMinutes(automation.spreadMinutes)

    // Even fan-out across the window. With more routes than minutes, several land on the
    // same minute and merge — the run simply gets denser, it never double-fires.
    return mergeByTime(
      routes.map((route, i) => ({
        time:   minutesToTime(startMin + Math.floor((i * window) / routes.length)),
        routes: [route],
      })),
    )
  }

  return mergeByTime([{ time: start, routes }])
}

/** The routes due at exactly this 'HH:MM'. Empty when nothing is scheduled then. */
export function routesDueAt(
  automation: ScheduleSpec | null | undefined,
  hhmm: string,
): string[] {
  return expandSchedule(automation).find(slot => slot.time === hhmm)?.routes ?? []
}

/** A window outside 1…1440 is meaningless; 60 matches the schema default. */
export function clampSpreadMinutes(value: number | undefined | null): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 60
  return Math.min(Math.max(Math.floor(n), 1), MINUTES_PER_DAY)
}

/**
 * The next moment this automation fires, as a Date, or null if it never does.
 * `from` is injected rather than read from the clock so the UI and tests stay pure.
 */
export function nextRunDate(
  automation: ScheduleSpec | null | undefined,
  from: Date = new Date(),
): Date | null {
  const slots = expandSchedule(automation)
  if (slots.length === 0) return null

  const nowMin = from.getHours() * 60 + from.getMinutes()

  // Strictly later than the current minute: a slot firing right now has already been
  // dispatched by the cron tick, so reporting it as "next" would freeze the label there.
  const todays = slots
    .map(s => timeToMinutes(s.time))
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b)

  const upcoming = todays.find(m => m > nowMin);

  const next = new Date(from)
  next.setSeconds(0, 0)
  if (upcoming === undefined) {
    next.setDate(next.getDate() + 1)
    next.setHours(Math.floor(todays[0]! / 60), todays[0]! % 60)
  } else {
    next.setHours(Math.floor(upcoming / 60), upcoming % 60)
  }
  return next
}
