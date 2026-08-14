import { checkAllFieldBudgets } from '../services/rumBudget.service.js';
import { registerCron } from '../lib/cron.js';

/**
 * Hourly. Field p75 moves slowly, but a bad deploy should not wait until tomorrow to be
 * noticed — and the incident dedup means an hourly check that finds the same breach
 * fifty times still sends exactly one message.
 */
export function registerRumBudgetCron(): void {
  registerCron({
    expression: '0 * * * *',
    tag:        '[RUM budgets]',
    announce:   'Field budget check running hourly.',
    run:        checkAllFieldBudgets,
  });
}
