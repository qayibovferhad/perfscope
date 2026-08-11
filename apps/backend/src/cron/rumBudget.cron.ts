import cron from 'node-cron';
import { checkAllFieldBudgets } from '../services/rumBudget.service.js';

/**
 * Hourly. Field p75 moves slowly, but a bad deploy should not wait until tomorrow to be
 * noticed — and the incident dedup means an hourly check that finds the same breach
 * fifty times still sends exactly one message.
 */
export function registerRumBudgetCron(): void {
  cron.schedule('0 * * * *', () => {
    checkAllFieldBudgets().catch((err: unknown) =>
      console.error('[RUM budgets] Unhandled error in cron:', (err as Error).message));
  });

  console.log('[Cron] Field budget check running hourly.');
}
