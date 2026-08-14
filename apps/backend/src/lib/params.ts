import type { AuditFormFactor } from '@perfscope/shared';

/**
 * Reading untrusted request values. Small on purpose — each helper answers one question
 * and leaves the default to the caller, because the defaults genuinely differ: CrUX reads
 * as mobile (that is what it grades), a RUM beacon as desktop, and the website list as
 * "both". Five hand-rolled copies of the form-factor check had five spellings of that.
 */

/** The value if it names a form factor, otherwise undefined — the caller owns the fallback. */
export function parseFormFactor(raw: unknown): AuditFormFactor | undefined {
  return raw === 'mobile' || raw === 'desktop' ? raw : undefined;
}

/**
 * An integer query param clamped to [min, max]; junk and absence read as `def`.
 * Replaces five hand-rolled `Math.min(Math.max(parseInt(...) || d, lo), hi)` chains.
 */
export function intParam(
  raw: unknown,
  { def, min = 1, max = Number.MAX_SAFE_INTEGER }: { def: number; min?: number; max?: number },
): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Math.min(Math.max(Number.isFinite(n) ? n : def, min), max);
}
