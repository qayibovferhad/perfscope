import { Monitor, Smartphone, Zap, Crosshair } from 'lucide-react';
import type { AuditFormFactor, AuditPrecision } from '@perfscope/shared';
import type { SegmentOption } from '@/shared/ui/segmented';

/** One definition of the device choice, so the analyzer and compare offer the same audit. */
export const DEVICE_MODES: SegmentOption<AuditFormFactor>[] = [
  { value: 'desktop', label: 'Desktop', icon: Monitor,    title: 'Audit as a desktop browser' },
  { value: 'mobile',  label: 'Mobile',  icon: Smartphone, title: 'Emulate a phone (412×823) — what Google ranks on' },
];

/** One definition of the measurement choice, so the analyzer and compare offer the same
 *  audit — a comparison run at a different precision than the analyzer's is not comparable
 *  with it, and the difference was invisible because compare had no control at all. */
export const PRECISION_MODES: SegmentOption<AuditPrecision>[] = [
  { value: 'single', label: 'Fast',    icon: Zap,       title: 'One measurement — quickest, but a single run swings by ±10 points' },
  { value: 'median', label: 'Precise', icon: Crosshair, title: 'Measure three times and report the median run — ~3× slower, far less noise' },
];

/** `m:ss`, the one format an audit's duration is written in — live or finished. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
