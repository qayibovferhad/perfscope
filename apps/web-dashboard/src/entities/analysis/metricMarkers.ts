/**
 * The three vitals marked on a timeline, and the colour each is drawn in.
 *
 * One list because two components draw the same markers on the same kind of chart: the
 * analyzer's request waterfall and the compare page's filmstrip. They had separate copies
 * and disagreed — the waterfall used theme tokens (teal / accent / amber) while the
 * filmstrip used hardcoded hex (blue / green / orange), so the same metric was a different
 * colour depending on which page you were on, and the filmstrip's markers kept their
 * colours when the theme changed.
 *
 * `glow` is the same hue at the `strong` step, for the halo drawn behind an active marker.
 */
/**
 * Only the three that mark a moment on a timeline. Narrower than `keyof CoreWebVitals` on
 * purpose: TBT and CLS are accumulated over a load rather than points in it, and
 * `TimelineData.metrics` does not carry CLS at all.
 */
export type MarkerVital = 'fcp' | 'lcp' | 'tti';

export const METRIC_MARKERS: {
  key:   MarkerVital;
  label: string;
  color: string;
  glow:  string;
  /** Tinted badge background. A step token, never `color` with an alpha suffix — the
   *  colours are `var(--ld-*)` strings, so `` `${color}18` `` is invalid CSS that fails
   *  silently (which is exactly how the filmstrip's badges lost their backgrounds). */
  soft:  string;
  /** 1px border for the same badge. */
  line:  string;
}[] = [
  { key: 'fcp', label: 'FCP', color: 'var(--ld-teal)',   glow: 'var(--ld-teal-strong)',   soft: 'var(--ld-teal-soft)',   line: 'var(--ld-teal-line)'   },
  { key: 'lcp', label: 'LCP', color: 'var(--ld-accent)', glow: 'var(--ld-accent-strong)', soft: 'var(--ld-accent-soft)', line: 'var(--ld-accent-line)' },
  { key: 'tti', label: 'TTI', color: 'var(--ld-amber)',  glow: 'var(--ld-amber-strong)',  soft: 'var(--ld-amber-soft)',  line: 'var(--ld-amber-line)'  },
];
