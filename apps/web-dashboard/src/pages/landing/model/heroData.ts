export const CIRC = 326.7;

export const TRUST_ITEMS = [
  'No card required',
  'Open source, MIT licensed',
  'First result in ~60s',
] as const;

export const METRICS_DATA = [
  { key: 'lcp', label: 'LCP', status: 'good', sub: 'Good'       },
  { key: 'cls', label: 'CLS', status: 'good', sub: 'Good'       },
  { key: 'tbt', label: 'TBT', status: 'warn', sub: 'Needs work' },
  { key: 'fcp', label: 'FCP', status: 'good', sub: 'Good'       },
] as const;

export const FINAL_METRICS = {
  lcp: '1.2s',
  cls: '0.04',
  tbt: '160ms',
  fcp: '0.9s',
} as const;
