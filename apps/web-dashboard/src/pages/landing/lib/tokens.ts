import type { CSSProperties } from 'react';

export const PANEL: CSSProperties = {
  background:           'var(--ps-panel-bg)',
  backdropFilter:       'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border:               '1px solid var(--ps-panel-border)',
  borderRadius:         '1.25rem',
  overflow:             'hidden',
};

export const GLASS: CSSProperties = {
  background:           'rgba(255,255,255,0.035)',
  backdropFilter:       'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border:               '1px solid rgba(255,255,255,0.08)',
  borderRadius:         '0.875rem',
};
