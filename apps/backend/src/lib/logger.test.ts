import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { log, configureLogger, runWithRequestContext, setErrorReporter, loggerSettings } from './logger.js';

/** Capture what a line would have been written as, without writing it. */
function captured(fn: () => void): { out: unknown[][]; err: unknown[][] } {
  const out: unknown[][] = [];
  const err: unknown[][] = [];
  const logSpy  = vi.spyOn(console, 'log').mockImplementation((...args) => { out.push(args); });
  const errSpy  = vi.spyOn(console, 'error').mockImplementation((...args) => { err.push(args); });
  try { fn(); } finally { logSpy.mockRestore(); errSpy.mockRestore(); }
  return { out, err };
}

const firstJson = (args: unknown[][]) => JSON.parse(String(args[0]?.[0]));

describe('logger', () => {
  beforeEach(() => configureLogger({ level: 'debug', format: 'json' }));
  afterEach(() => setErrorReporter(null));

  it('writes one JSON object per line, with level, scope and message', () => {
    const { out } = captured(() => log.info('Socket', 'analysis started', { url: 'https://example.com' }));
    const line = firstJson(out);
    expect(line).toMatchObject({ level: 'info', scope: 'Socket', msg: 'analysis started', url: 'https://example.com' });
    expect(Date.parse(line.ts)).not.toBeNaN();
  });

  it('sends warn and error to stderr, everything else to stdout', () => {
    const { out, err } = captured(() => {
      log.debug('x', 'a'); log.info('x', 'b'); log.warn('x', 'c'); log.error('x', 'd');
    });
    expect(out).toHaveLength(2);
    expect(err).toHaveLength(2);
  });

  it('drops anything below the configured level', () => {
    configureLogger({ level: 'warn', format: 'json' });
    const { out, err } = captured(() => { log.debug('x', 'a'); log.info('x', 'b'); log.warn('x', 'c'); });
    expect(out).toHaveLength(0);
    expect(err).toHaveLength(1);
  });

  it('keeps the human format on a laptop: [Scope] message', () => {
    configureLogger({ level: 'debug', format: 'text' });
    const { out } = captured(() => log.info('NightlyAudit', 'auditing', { url: 'https://example.com' }));
    expect(out[0]?.[0]).toBe('[NightlyAudit] auditing');
    expect(out[0]?.[1]).toEqual({ url: 'https://example.com' });
  });

  it('serialises an Error instead of writing {}', () => {
    const { err } = captured(() => log.error('AI', 'insights failed', { err: new Error('quota exceeded') }));
    expect(firstJson(err).err).toMatchObject({ name: 'Error', message: 'quota exceeded' });
    expect(firstJson(err).err.stack).toContain('quota exceeded');
  });

  it('redacts anything that looks like a credential, however deep', () => {
    const { out } = captured(() => log.info('Auth', 'signed in', {
      user: { email: 'a@b.c', password: 'hunter2', session: { cookie: 'sid=1' } },
      refreshToken: 'abc',
      url: 'https://example.com',
    }));
    const line = firstJson(out);
    expect(line.user.password).toBe('[redacted]');
    expect(line.user.session).toBe('[redacted]');
    expect(line.refreshToken).toBe('[redacted]');
    // Ordinary fields are untouched — redaction that ate the context would make the line
    // useless rather than safe.
    expect(line.user.email).toBe('a@b.c');
    expect(line.url).toBe('https://example.com');
  });

  it('carries the request id through whatever is logged under it', () => {
    const { out } = captured(() => runWithRequestContext({ requestId: 'req-1' }, () => {
      log.info('Socket', 'inside');
    }));
    expect(firstJson(out).requestId).toBe('req-1');
  });

  it('survives a circular field rather than throwing inside a log call', () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular['self'] = circular;
    const { out } = captured(() => log.info('x', 'circular', { circular }));
    expect(out).toHaveLength(1);
  });

  it('reports errors onward, once, and never lets a broken reporter escape', () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    captured(() => { log.warn('x', 'not reported'); log.error('x', 'reported', { err: new Error('boom') }); });
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0]?.[1]).toBe('reported');

    setErrorReporter(() => { throw new Error('reporter is down'); });
    expect(() => captured(() => log.error('x', 'still logs'))).not.toThrow();
  });

  it('reports its own settings, for the line that announces them', () => {
    configureLogger({ level: 'warn', format: 'json' });
    expect(loggerSettings()).toEqual({ level: 'warn', format: 'json' });
  });
});
