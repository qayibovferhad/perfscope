import {
  MousePointerClick, Keyboard, CornerDownLeft, Pointer, MoveVertical,
  Eye, Timer, Navigation, Camera, type LucideIcon,
} from 'lucide-react';
import { describeFlowStep, type FlowStep, type FlowActionKind } from '@perfscope/shared';

const GLYPH: Record<FlowActionKind, LucideIcon> = {
  click:    MousePointerClick,
  type:     Keyboard,
  press:    CornerDownLeft,
  hover:    Pointer,
  scroll:   MoveVertical,
  waitFor:  Eye,
  wait:     Timer,
  navigate: Navigation,
};

/**
 * A flow's steps as the chain they are.
 *
 * The card used to say "Click .buy → Type into #qty → +2 more", which is the shape of the
 * journey flattened into a sentence — and a flow *is* its shape: a load, then a run of
 * interactions, then the state it leaves behind. Drawn, the difference between a
 * two-interaction flow and a nine-step one is visible from across the room, and the
 * unmeasured plumbing steps (a cookie banner, a field filled before the button that
 * matters) are visibly not the subject.
 *
 * Load and snapshot are drawn as the chain's end caps, because that is what they are: the
 * navigation nobody scripted and the DOM audit at the end.
 */
export function StepChain({
  steps, snapshotAtEnd, className,
}: {
  steps: FlowStep[];
  snapshotAtEnd?: boolean;
  className?: string;
}) {
  return (
    <ol className={`flex items-center gap-0 flex-wrap ${className ?? ''}`}>
      <Node
        icon={Navigation}
        title="Load the page"
        measured
        // The cold navigation is not one of the flow's own steps — it is where every flow
        // starts, and a flow that did not load the page measured nothing.
        cap
      />

      {steps.map((step, i) => (
        <Node
          key={i}
          icon={GLYPH[step.action]}
          title={step.name || describeFlowStep(step)}
          measured={step.measure !== false}
          connector
        />
      ))}

      {snapshotAtEnd && (
        <Node icon={Camera} title="Audit the final state" measured cap connector />
      )}
    </ol>
  );
}

function Node({
  icon: Icon, title, measured, cap = false, connector = false,
}: { icon: LucideIcon; title: string; measured: boolean; cap?: boolean; connector?: boolean }) {
  return (
    <li className="flex items-center min-w-0">
      {/* The connector belongs to the node after it, so the chain never ends in a
          dangling rule when the steps wrap onto a second line. */}
      {connector && <span aria-hidden className="w-[13px] h-px bg-ld-border" />}
      <span
        title={title}
        className={[
          'w-[28px] h-[28px] rounded-[9px] grid place-items-center border shrink-0 [&_svg]:w-[14px] [&_svg]:h-[14px]',
          measured
            ? 'border-ld-accent-line bg-ld-accent-soft text-ld-accent'
            // Not measured: drawn as plumbing, in the chain but not part of the reading.
            : 'border-ld-border bg-ld-surface-2 text-ld-text-3 border-dashed',
          cap ? 'rounded-full' : '',
        ].join(' ')}
      >
        <Icon />
        <span className="sr-only">{title}</span>
      </span>
    </li>
  );
}
