import { describe, it, expect } from 'vitest'
import {
  expandSchedule,
  routesDueAt,
  nextRunDate,
  minutesToTime,
  timeToMinutes,
  clampSpreadMinutes,
} from './schedule'
import type { WebsiteAutomation } from '../types/website.js'

function automation(patch: Partial<WebsiteAutomation>): Partial<WebsiteAutomation> {
  return { enabled: true, routes: [], scheduleTime: '02:00', lastRunAt: null, ...patch }
}

describe('time helpers', () => {
  it('round-trips HH:MM', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('02:15')).toBe(135)
    expect(timeToMinutes('23:59')).toBe(1439)
    expect(minutesToTime(135)).toBe('02:15')
  })

  it('rejects malformed times instead of guessing', () => {
    expect(timeToMinutes('24:00')).toBeNull()
    expect(timeToMinutes('2:00')).toBeNull()
    expect(timeToMinutes('02:60')).toBeNull()
    expect(timeToMinutes('')).toBeNull()
  })

  it('wraps past midnight rather than overflowing', () => {
    expect(minutesToTime(1440)).toBe('00:00')
    expect(minutesToTime(1500)).toBe('01:00')
    expect(minutesToTime(-60)).toBe('23:00')
  })

  it('clamps the spread window to a real day', () => {
    expect(clampSpreadMinutes(60)).toBe(60)
    expect(clampSpreadMinutes(0)).toBe(1)
    expect(clampSpreadMinutes(99999)).toBe(1440)
    expect(clampSpreadMinutes(undefined)).toBe(60)
  })
})

describe('expandSchedule — single', () => {
  it('puts every route in one block, which is the pre-slots behaviour', () => {
    expect(expandSchedule(automation({ routes: ['/', '/pricing'] })))
      .toEqual([{ time: '02:00', routes: ['/', '/pricing'] }])
  })

  it('treats a document with no scheduleMode as single', () => {
    const legacy = { enabled: true, routes: ['/'], scheduleTime: '03:30', lastRunAt: null }
    expect(expandSchedule(legacy)).toEqual([{ time: '03:30', routes: ['/'] }])
  })

  it('is empty with no routes — nothing to run is not the same as running everything', () => {
    expect(expandSchedule(automation({ routes: [] }))).toEqual([])
  })

  it('is empty for a malformed time rather than silently defaulting to midnight', () => {
    expect(expandSchedule(automation({ routes: ['/'], scheduleTime: '2:00' }))).toEqual([])
  })
})

describe('expandSchedule — slots', () => {
  const base = automation({
    routes: ['/', '/pricing', '/blog'],
    scheduleMode: 'slots',
  })

  it('keeps groups apart and sorts them by time', () => {
    expect(expandSchedule({
      ...base,
      slots: [
        { time: '14:00', routes: ['/blog'] },
        { time: '02:00', routes: ['/', '/pricing'] },
      ],
    })).toEqual([
      { time: '02:00', routes: ['/', '/pricing'] },
      { time: '14:00', routes: ['/blog'] },
    ])
  })

  it('merges two slots on the same minute so nothing fires twice', () => {
    expect(expandSchedule({
      ...base,
      slots: [
        { time: '02:00', routes: ['/', '/pricing'] },
        { time: '02:00', routes: ['/pricing', '/blog'] },
      ],
    })).toEqual([{ time: '02:00', routes: ['/', '/pricing', '/blog'] }])
  })

  it('drops routes the site no longer has', () => {
    expect(expandSchedule({
      ...base,
      slots: [{ time: '02:00', routes: ['/', '/deleted-route'] }],
    })).toEqual([{ time: '02:00', routes: ['/'] }])
  })

  it('drops slots that end up empty, and malformed times', () => {
    expect(expandSchedule({
      ...base,
      slots: [
        { time: '02:00', routes: [] },
        { time: '25:00', routes: ['/'] },
        { time: '05:00', routes: ['/blog'] },
      ],
    })).toEqual([{ time: '05:00', routes: ['/blog'] }])
  })

  it('ignores the routes list ordering and uses only what the slots assign', () => {
    expect(expandSchedule({ ...base, slots: [] })).toEqual([])
  })
})

describe('expandSchedule — spread', () => {
  it('fans four routes evenly across one hour', () => {
    expect(expandSchedule(automation({
      routes: ['/', '/pricing', '/blog', '/docs'],
      scheduleMode: 'spread',
      scheduleTime: '02:00',
      spreadMinutes: 60,
    }))).toEqual([
      { time: '02:00', routes: ['/'] },
      { time: '02:15', routes: ['/pricing'] },
      { time: '02:30', routes: ['/blog'] },
      { time: '02:45', routes: ['/docs'] },
    ])
  })

  it('spreads across the whole day at 1440 minutes', () => {
    const slots = expandSchedule(automation({
      routes: ['/a', '/b', '/c'],
      scheduleMode: 'spread',
      scheduleTime: '00:00',
      spreadMinutes: 1440,
    }))
    expect(slots.map(s => s.time)).toEqual(['00:00', '08:00', '16:00'])
  })

  it('wraps past midnight when the window runs off the end of the day', () => {
    const slots = expandSchedule(automation({
      routes: ['/a', '/b'],
      scheduleMode: 'spread',
      scheduleTime: '23:00',
      spreadMinutes: 120,
    }))
    expect(slots.map(s => s.time).sort()).toEqual(['00:00', '23:00'])
  })

  it('merges rather than double-firing when there are more routes than minutes', () => {
    const routes = ['/a', '/b', '/c', '/d', '/e']
    const slots  = expandSchedule(automation({
      routes, scheduleMode: 'spread', scheduleTime: '02:00', spreadMinutes: 2,
    }))
    expect(slots.flatMap(s => s.routes).sort()).toEqual(routes)
    expect(new Set(slots.map(s => s.time)).size).toBe(slots.length)
  })

  it('is empty with no routes', () => {
    expect(expandSchedule(automation({ routes: [], scheduleMode: 'spread' }))).toEqual([])
  })
})

describe('routesDueAt', () => {
  const slotted = automation({
    routes: ['/', '/pricing', '/blog'],
    scheduleMode: 'slots',
    slots: [
      { time: '02:00', routes: ['/', '/pricing'] },
      { time: '14:00', routes: ['/blog'] },
    ],
  })

  it('returns only the routes for that minute', () => {
    expect(routesDueAt(slotted, '02:00')).toEqual(['/', '/pricing'])
    expect(routesDueAt(slotted, '14:00')).toEqual(['/blog'])
  })

  it('returns nothing every other minute of the day', () => {
    expect(routesDueAt(slotted, '02:01')).toEqual([])
    expect(routesDueAt(slotted, '13:59')).toEqual([])
    expect(routesDueAt(slotted, '00:00')).toEqual([])
  })

  it('handles a missing automation without throwing', () => {
    expect(routesDueAt(null, '02:00')).toEqual([])
    expect(routesDueAt(undefined, '02:00')).toEqual([])
  })
})

describe('nextRunDate', () => {
  const at = (h: number, m: number) => new Date(2026, 0, 15, h, m, 30)

  const slotted = automation({
    routes: ['/', '/blog'],
    scheduleMode: 'slots',
    slots: [
      { time: '02:00', routes: ['/'] },
      { time: '14:00', routes: ['/blog'] },
    ],
  })

  it('picks the next slot later today', () => {
    const next = nextRunDate(slotted, at(9, 0))!
    expect([next.getDate(), next.getHours(), next.getMinutes()]).toEqual([15, 14, 0])
  })

  it('rolls to the first slot tomorrow once the day is done', () => {
    const next = nextRunDate(slotted, at(18, 0))!
    expect([next.getDate(), next.getHours(), next.getMinutes()]).toEqual([16, 2, 0])
  })

  it('skips a slot firing this very minute — the cron already dispatched it', () => {
    const next = nextRunDate(slotted, at(2, 0))!
    expect(next.getHours()).toBe(14)
  })

  it('is null when nothing is scheduled', () => {
    expect(nextRunDate(automation({ routes: [] }), at(9, 0))).toBeNull()
  })
})
