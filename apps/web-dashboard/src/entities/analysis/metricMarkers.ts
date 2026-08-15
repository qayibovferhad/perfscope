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
}[] = [
  { key: 'fcp', label: 'FCP', color: 'var(--ld-teal)',   glow: 'var(--ld-teal-strong)'   },
  { key: 'lcp', label: 'LCP', color: 'var(--ld-accent)', glow: 'var(--ld-accent-strong)' },
  { key: 'tti', label: 'TTI', color: 'var(--ld-amber)',  glow: 'var(--ld-amber-strong)'  },
];
