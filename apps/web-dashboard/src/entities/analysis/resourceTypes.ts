import { FileCode2, Palette, ImageIcon, Type, Globe } from 'lucide-react';
import type { ResourceType } from '@perfscope/shared';

/**
 * How each kind of network resource is labelled and coloured.
 *
 * One definition, because there were four and they had started to disagree.
 * ResourceWaterfall held it as raw colour strings, TimelineWaterfall as Tailwind classes,
 * ResourceDependencyChain as a third set at a different alpha — and both of the latter
 * carried a comment saying "see ResourceWaterfall", which is a coupling nobody could
 * enforce. (ResourceBreakdown has a genuinely different palette — script amber, document
 * rose — and is deliberately left alone: reconciling it is a design decision, not a
 * refactor.)
 *
 * Five colour roles, because a bar and its badge are not the same hue: `bar` is the solid
 * download segment, `wait` its lighter TTFB half, and `text`/`tint`/`line` are the badge's
 * foreground, fill and border.
 */
export interface ResourceTypeMeta {
  label: string;
  icon:  React.ElementType;
  /** Solid fill of the download segment. */
  bar:  string;
  /** The waiting (TTFB) segment — same hue, lower alpha. */
  wait: string;
  /** Badge foreground. */
  text: string;
  /** Badge fill. */
  tint: string;
  /** Badge border. */
  line: string;
}

export const RESOURCE_TYPES: Record<ResourceType, ResourceTypeMeta> = {
  script: {
    label: 'JS', icon: FileCode2,
    bar: 'rgba(99,102,241,1)', wait: 'rgba(99,102,241,0.5)',
    text: '#818cf8', tint: 'rgba(99,102,241,.12)', line: 'rgba(99,102,241,.3)',
  },
  stylesheet: {
    label: 'CSS', icon: Palette,
    bar: 'rgba(167,139,250,1)', wait: 'rgba(167,139,250,0.5)',
    text: '#a78bfa', tint: 'rgba(167,139,250,.12)', line: 'rgba(167,139,250,.3)',
  },
  image: {
    label: 'IMG', icon: ImageIcon,
    bar: 'var(--ld-accent)', wait: 'var(--ld-accent-soft)',
    text: 'var(--ld-accent)', tint: 'var(--ld-accent-soft)', line: 'var(--ld-accent-line)',
  },
  font: {
    label: 'FONT', icon: Type,
    bar: 'var(--ld-amber)', wait: 'var(--ld-amber-strong)',
    text: 'var(--ld-amber)', tint: 'var(--ld-amber-soft)', line: 'var(--ld-amber-line)',
  },
  document: {
    label: 'DOC', icon: FileCode2,
    bar: 'rgba(56,189,248,1)', wait: 'rgba(56,189,248,0.4)',
    text: '#38bdf8', tint: 'rgba(56,189,248,.1)', line: 'rgba(56,189,248,.3)',
  },
  media: {
    label: 'MEDIA', icon: ImageIcon,
    bar: 'rgba(244,114,182,1)', wait: 'rgba(244,114,182,0.4)',
    text: '#f472b6', tint: 'rgba(244,114,182,.1)', line: 'rgba(244,114,182,.3)',
  },
  other: {
    label: 'XHR', icon: Globe,
    bar: 'var(--ld-text-3)', wait: 'var(--ld-border-strong)',
    text: 'var(--ld-text-3)', tint: 'transparent', line: 'var(--ld-border-strong)',
  },
};

/** Badge styling for a resource type — the same three properties at every call site. */
export function resourceBadgeStyle(type: ResourceType): React.CSSProperties {
  const meta = RESOURCE_TYPES[type];
  return { color: meta.text, background: meta.tint, borderColor: meta.line };
}
