/**
 * What an alert is called, in words.
 *
 * The keys are the stored `AlertLog.event` values and **cannot change** — an open incident
 * is matched by event name, so renaming one orphans every incident already firing (see
 * `baseEvent` in the backend's alerts.service). The labels are the half a person reads, and
 * they live here because two surfaces now show the same alerts: the dashboard's incident
 * list, which asks "what is broken", and the bell, which asks "what happened".
 */
export const ALERT_EVENT_LABEL: Record<string, string> = {
  'budget.breach':    'Target missed',
  'budget.recovered': 'Target recovered',
  'audit.regression': 'Regression',
  'rum.breach':       'Field target missed',
  // A flow's targets are about an interaction, not about a page load, and the incident list
  // is read by someone deciding what to open — "Interaction slower" says which of the two.
  'flow.breach':      'Interaction slower',
  'flow.recovered':   'Interaction recovered',
}

/** The stored name when there is no label for it — better than an empty chip. */
export function alertEventLabel(event: string): string {
  return ALERT_EVENT_LABEL[event] ?? event
}
