import { describe, it, expect } from 'vitest';
import { parseAutomationUpdate, parseBudgets } from './websiteInput.js';
import { AppError } from '../lib/errors.js';

describe('parseAutomationUpdate', () => {
  it('builds the dot-path update Mongo applies', () => {
    expect(parseAutomationUpdate({ enabled: true, routes: ['/', '/pricing'], scheduleTime: '03:30' })).toEqual({
      'automation.enabled': true,
      'automation.routes': ['/', '/pricing'],
      'automation.scheduleTime': '03:30',
    });
  });

  it('rejects a malformed time rather than dropping it', () => {
    // Silently ignoring a bad value is how an automation ends up looking configured and
    // never firing.
    for (const bad of ['3:30', '25:00', 'morning', '']) {
      expect(() => parseAutomationUpdate({ enabled: true, scheduleTime: bad })).toThrow(AppError);
    }
  });

  it('rejects an unknown schedule mode', () => {
    expect(() => parseAutomationUpdate({ scheduleMode: 'hourly' as never })).toThrow(/scheduleMode must be one of/);
  });

  it('keeps slots whole — a slot with no routes is a mistake, not an empty plan', () => {
    expect(parseAutomationUpdate({ slots: [{ time: '02:00', routes: ['/', ''] }] }))
      .toEqual({ 'automation.slots': [{ time: '02:00', routes: ['/'] }] });

    expect(() => parseAutomationUpdate({ slots: [{ time: '02:00', routes: [] }] })).toThrow(/no routes/);
    expect(() => parseAutomationUpdate({ slots: [{ routes: ['/'] }] })).toThrow(/Slot time must be HH:MM/);
    expect(() => parseAutomationUpdate({ slots: 'nope' as never })).toThrow(/slots must be an array/);
  });

  it('caps slots at one an hour', () => {
    const slots = Array.from({ length: 25 }, () => ({ time: '02:00', routes: ['/'] }));
    expect(() => parseAutomationUpdate({ slots })).toThrow(/At most 24 slots/);
  });

  it('bounds the spread window to a day', () => {
    expect(parseAutomationUpdate({ spreadMinutes: 90 })).toEqual({ 'automation.spreadMinutes': 90 });
    for (const bad of [0, 1441, 12.5]) {
      expect(() => parseAutomationUpdate({ spreadMinutes: bad })).toThrow(/spreadMinutes must be an integer/);
    }
  });

  it('refuses an update that would change nothing', () => {
    expect(() => parseAutomationUpdate({})).toThrow(/Provide enabled or routes/);
  });
});

describe('parseBudgets', () => {
  it('keeps thresholds that are in range', () => {
    const parsed = parseBudgets({ performance: 90, lcp: 2500, tbt: 200, cls: 0.1, inp: 200 });
    expect(parsed).toEqual({ budgets: {
      performance: 90, lcp: 2500, tbt: 200, cls: 0.1, inp: 200, webhookUrl: null, alertEmail: null,
    } });
  });

  it('reads an out-of-range or non-numeric threshold as unset', () => {
    // The form sends every field every time, and a blank one is how a target is removed —
    // so a value it cannot use has to clear that field, not fail the whole save.
    const parsed = parseBudgets({ performance: 0, lcp: 99, cls: 0, inp: '200' as never, tbt: 100 });
    expect(parsed).toEqual({ budgets: {
      performance: null, lcp: null, tbt: 100, cls: null, inp: null, webhookUrl: null, alertEmail: null,
    } });
  });

  it('clears the record only when the form is completely blank', () => {
    expect(parseBudgets({})).toEqual({ budgets: null });
    expect(parseBudgets({ performance: null, webhookUrl: '  ' })).toEqual({ budgets: null });
  });

  it('keeps a channel with no thresholds at all', () => {
    // Regression alerts need somewhere to send without any target being set.
    const parsed = parseBudgets({ alertEmail: ' someone@example.com ' });
    expect(parsed).toMatchObject({ budgets: { alertEmail: 'someone@example.com', performance: null } });
  });

  it('validates the channels it is given', () => {
    expect(() => parseBudgets({ webhookUrl: 'not-a-url' })).toThrow(/webhookUrl must be a valid/);
    expect(() => parseBudgets({ alertEmail: 'not-an-email' })).toThrow(/alertEmail must be a valid/);
  });

  it('normalises the webhook URL it stores', () => {
    const parsed = parseBudgets({ webhookUrl: ' https://hooks.slack.com/services/x ' }) as { budgets: { webhookUrl: string } };
    expect(parsed.budgets.webhookUrl).toBe('https://hooks.slack.com/services/x');
  });
});
