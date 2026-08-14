/**
 * `null` for an empty set, never 0 — because for a score those mean opposite things:
 * "no audits yet" and "audited, and it scored zero" would otherwise render identically.
 *
 * Callers that genuinely want 0 (a headline tile reading "—" would be worse than "0")
 * write `?? 0`, which puts the decision where someone can see it. Four copies of this
 * had baked 0 in and one had baked null in, and none of them said why.
 */
export function meanRounded(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}
