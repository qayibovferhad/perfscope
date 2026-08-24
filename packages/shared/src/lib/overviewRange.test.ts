import { describe, it, expect } from 'vitest';
import {
  isDayKey, addDays, daysBetween, dayKeysBetween, resolveOverviewRange, MAX_RANGE_DAYS,
} from './overviewRange';

const TODAY = '2026-08-24';

describe('isDayKey', () => {
  it('accepts a real calendar day', () => {
    expect(isDayKey('2026-08-24')).toBe(true);
    expect(isDayKey('2024-02-29')).toBe(true);   // a leap day is a day
  });

  it('rejects the shape without the date', () => {
    // `2026-02-31` passes a regex and is not a day; Date would roll it to March.
    for (const bad of ['2026-02-31', '2026-13-01', '24-08-2026', '2026-8-4', '', null, 20260824]) {
      expect(isDayKey(bad), String(bad)).toBe(false);
    }
  });
});

describe('day arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('counts both ends — a single day is one day, not none', () => {
    expect(daysBetween('2026-08-24', '2026-08-24')).toBe(1);
    expect(daysBetween('2026-08-18', '2026-08-24')).toBe(7);
  });

  it('lists every day in between, so a gap stays a gap on the axis', () => {
    expect(dayKeysBetween('2026-08-22', '2026-08-25'))
      .toEqual(['2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25']);
    expect(dayKeysBetween('2026-08-24', '2026-08-24')).toEqual(['2026-08-24']);
  });
});

describe('resolveOverviewRange — the shorthand', () => {
  it('reads "days" as the last N ending today, both ends counted', () => {
    expect(resolveOverviewRange({ days: 7 }, TODAY)).toEqual({ from: '2026-08-18', to: TODAY, days: 7 });
    expect(resolveOverviewRange({ days: 1 }, TODAY)).toEqual({ from: TODAY, to: TODAY, days: 1 });
  });

  it('falls back to the default for junk and absence', () => {
    expect(resolveOverviewRange({}, TODAY).days).toBe(30);
    expect(resolveOverviewRange({ days: 'lots' }, TODAY).days).toBe(30);
  });

  it('treats a missing search param as absent, not as zero', () => {
    // `params.get('days')` is null when the URL has none, and `Number(null)` is 0 — which
    // clamped to a one-day window and opened the dashboard on today. The screenshot of that
    // is why this test exists.
    expect(resolveOverviewRange({ days: null }, TODAY).days).toBe(30);
    expect(resolveOverviewRange({ days: '' }, TODAY).days).toBe(30);
  });

  it('clamps rather than refusing — these arrive in an editable URL', () => {
    expect(resolveOverviewRange({ days: 0 }, TODAY).days).toBe(1);
    expect(resolveOverviewRange({ days: 99_999 }, TODAY).days).toBe(MAX_RANGE_DAYS);
  });
});

describe('resolveOverviewRange — an explicit range', () => {
  it('uses the pair the picker produced', () => {
    expect(resolveOverviewRange({ from: '2026-08-01', to: '2026-08-14' }, TODAY))
      .toEqual({ from: '2026-08-01', to: '2026-08-14', days: 14 });
  });

  it('beats the shorthand when both are present', () => {
    // A link carrying both is a link someone edited; the specific one is the intent.
    expect(resolveOverviewRange({ days: 90, from: '2026-08-01', to: '2026-08-02' }, TODAY).days).toBe(2);
  });

  it('puts a backwards pair the right way round', () => {
    // A range picker produces one while the second click is still pending.
    expect(resolveOverviewRange({ from: '2026-08-14', to: '2026-08-01' }, TODAY))
      .toMatchObject({ from: '2026-08-01', to: '2026-08-14' });
  });

  it('never asks about days nobody has measured yet', () => {
    expect(resolveOverviewRange({ from: '2026-08-20', to: '2026-12-31' }, TODAY))
      .toEqual({ from: '2026-08-20', to: TODAY, days: 5 });
  });

  it('keeps the recent end when a range is too long', () => {
    // The clamp moves `from`, not `to`: the end somebody is looking at is the recent one.
    const range = resolveOverviewRange({ from: '2000-01-01', to: TODAY }, TODAY);
    expect(range).toMatchObject({ to: TODAY, days: MAX_RANGE_DAYS });
    expect(range.from).toBe(addDays(TODAY, -(MAX_RANGE_DAYS - 1)));
  });

  it('ignores a half-given pair and falls back to the shorthand', () => {
    // One end alone says nothing — "since August" and "until August" are different windows
    // and neither is what a single value means.
    expect(resolveOverviewRange({ from: '2026-08-01', days: 7 }, TODAY).days).toBe(7);
    expect(resolveOverviewRange({ to: '2026-08-01' }, TODAY).days).toBe(30);
  });
});
