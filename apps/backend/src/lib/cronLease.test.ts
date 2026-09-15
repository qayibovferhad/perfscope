import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn();
vi.mock('../models/CronLease.model.js', () => ({ CronLease: { create: (doc: unknown) => create(doc) } }));

const { claimTick, leaseKey, tickBucket } = await import('./cronLease.js');

const MINUTE = 60_000;
const at = (iso: string) => Date.parse(iso);

describe('tickBucket', () => {
  it('puts two instances either side of the minute into the same tick', () => {
    // Floored, these would be 11:59 and 12:00 — two keys, and both instances would run.
    expect(tickBucket(at('2026-09-15T11:59:59.800Z'), MINUTE))
      .toBe(tickBucket(at('2026-09-15T12:00:00.150Z'), MINUTE));
  });

  it('keeps neighbouring ticks apart', () => {
    expect(leaseKey('NightlyAudit', at('2026-09-15T12:00:00.100Z'), MINUTE))
      .not.toBe(leaseKey('NightlyAudit', at('2026-09-15T12:01:00.100Z'), MINUTE));
  });

  it('names the job, so two jobs on the same minute do not block each other', () => {
    const now = at('2026-09-15T12:00:00Z');
    expect(leaseKey('Digest', now, MINUTE)).toBe('Digest@2026-09-15T12:00:00.000Z');
    expect(leaseKey('Digest', now, MINUTE)).not.toBe(leaseKey('NightlyAudit', now, MINUTE));
  });
});

describe('claimTick', () => {
  beforeEach(() => { create.mockReset(); });

  it('runs the tick when the insert lands', async () => {
    create.mockResolvedValue({});
    await expect(claimTick('Digest', MINUTE, at('2026-09-15T12:00:00Z'))).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      _id:       'Digest@2026-09-15T12:00:00.000Z',
      expiresAt: new Date('2026-09-15T12:02:00.000Z'),
    }));
  });

  it('skips the tick when another instance already claimed it', async () => {
    create.mockImplementation(() => Promise.reject(Object.assign(new Error('E11000 duplicate key'), { code: 11000 })));
    await expect(claimTick('Digest', MINUTE)).resolves.toBe(false);
  });

  it('throws anything else rather than reading it as "someone else has it"', async () => {
    create.mockImplementation(() => Promise.reject(new Error('not primary')));
    await expect(claimTick('Digest', MINUTE)).rejects.toThrow('not primary');
  });
});
