/**
 * Which side of a comparison something belongs to, and how that reads.
 *
 * "Your site is accent, the rival is amber" was re-derived as an inline ternary at
 * thirteen places across six files, and had already drifted: the identity dot was 9px in
 * three of them, 8px in the filmstrip and 6px in the deep comparison. Same reasoning as
 * the BAND_* maps in entities/analysis — never write the ternary in a component.
 */

export type CompareSide = 'you' | 'rival';

export const sideOf = (isYou: boolean): CompareSide => (isYou ? 'you' : 'rival');

/** Label text. `-accent-2` rather than `-accent` because this sits on a surface. */
export const SIDE_TEXT: Record<CompareSide, string> = {
  you:   'text-ld-accent-2',
  rival: 'text-ld-amber',
};

/** The identity dot, and any other solid fill. */
export const SIDE_DOT: Record<CompareSide, string> = {
  you:   'bg-ld-accent',
  rival: 'bg-ld-amber',
};

/** For SVG attributes and inline styles, where a class cannot reach. */
export const SIDE_VAR: Record<CompareSide, string> = {
  you:   'var(--ld-accent-2)',
  rival: 'var(--ld-amber)',
};

export const SIDE_LABEL: Record<CompareSide, string> = {
  you:   'Your Site',
  rival: 'Competitor',
};
