import { describeFlowStep, type FlowStep } from '@perfscope/shared';

/**
 * A flow's steps as one line for a list row.
 *
 * Named actions win over generated ones, and the measured steps lead: a row that reads
 * "Click #cookie-accept, Type into #email, Click #pay" buries the interaction the flow
 * exists for behind its plumbing.
 */
export function describeSteps(steps: FlowStep[]): string {
  const measured = steps.filter(s => s.measure !== false);
  const shown = (measured.length ? measured : steps).slice(0, 3);
  const label = (step: FlowStep) => step.name || describeFlowStep(step);

  const rest = (measured.length ? measured : steps).length - shown.length;
  return shown.map(label).join(' → ') + (rest > 0 ? ` → +${rest} more` : '');
}
