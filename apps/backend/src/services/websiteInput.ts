import { isValidTime, MINUTES_PER_DAY, type AutomationScheduleMode } from '@perfscope/shared';
import { AppError } from '../lib/errors.js';
import { EMAIL_RE } from '../lib/validate.js';

/**
 * Parsing and validating the settings bodies for a Website.
 *
 * Lifted out of the route file, where 130 lines of hand-rolled checking sat between the
 * reader and what the endpoints actually did. Pure functions: they either return the
 * update to apply or throw the AppError the client should see.
 */

const SCHEDULE_MODES: AutomationScheduleMode[] = ['single', 'slots', 'spread'];
/** One slot per hour is already a very busy site; past that it is a mistake, not a plan. */
const MAX_SLOTS = 24;

/** Budget bounds, beside the fields they bound rather than inline at the call site. */
const BUDGET_RANGE = {
  performance: [1, 100],
  lcp:         [100, 60_000],
  tbt:         [0, 60_000],
  cls:         [0.01, 5],
  inp:         [10, 60_000],
} as const;

export interface AutomationBody {
  enabled?:       boolean;
  routes?:        string[];
  scheduleTime?:  string;
  scheduleMode?:  AutomationScheduleMode;
  slots?:         Array<{ time?: string; routes?: string[] }>;
  spreadMinutes?: number;
}

/**
 * The dot-path update for PATCH /websites/:id/automation.
 *
 * Malformed values are rejected, never dropped: silently ignoring a bad time is how an
 * automation ends up looking configured and never firing.
 */
export function parseAutomationUpdate(body: AutomationBody): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (typeof body.enabled === 'boolean') update['automation.enabled'] = body.enabled;
  if (Array.isArray(body.routes))        update['automation.routes']  = body.routes;

  if (body.scheduleTime !== undefined) {
    if (typeof body.scheduleTime !== 'string' || !isValidTime(body.scheduleTime)) {
      throw new AppError(400, 'scheduleTime must be HH:MM (00:00–23:59)');
    }
    update['automation.scheduleTime'] = body.scheduleTime;
  }

  if (body.scheduleMode !== undefined) {
    if (!SCHEDULE_MODES.includes(body.scheduleMode)) {
      throw new AppError(400, `scheduleMode must be one of ${SCHEDULE_MODES.join(', ')}`);
    }
    update['automation.scheduleMode'] = body.scheduleMode;
  }

  if (body.slots !== undefined) {
    if (!Array.isArray(body.slots))      throw new AppError(400, 'slots must be an array');
    if (body.slots.length > MAX_SLOTS)   throw new AppError(400, `At most ${MAX_SLOTS} slots`);

    const slots: Array<{ time: string; routes: string[] }> = [];
    for (const slot of body.slots) {
      if (typeof slot?.time !== 'string' || !isValidTime(slot.time)) {
        throw new AppError(400, `Slot time must be HH:MM (got "${String(slot?.time)}")`);
      }
      const routes = Array.isArray(slot.routes)
        ? slot.routes.filter(r => typeof r === 'string' && r.length > 0)
        : [];
      if (routes.length === 0) throw new AppError(400, `Slot ${slot.time} has no routes`);

      slots.push({ time: slot.time, routes });
    }
    update['automation.slots'] = slots;
  }

  if (body.spreadMinutes !== undefined) {
    const n = Number(body.spreadMinutes);
    if (!Number.isInteger(n) || n < 1 || n > MINUTES_PER_DAY) {
      throw new AppError(400, `spreadMinutes must be an integer between 1 and ${MINUTES_PER_DAY}`);
    }
    update['automation.spreadMinutes'] = n;
  }

  if (Object.keys(update).length === 0) {
    throw new AppError(400, 'Provide enabled or routes to update');
  }

  return update;
}

export interface BudgetsBody {
  performance?: number | null; lcp?: number | null; tbt?: number | null;
  cls?: number | null; inp?: number | null;
  webhookUrl?: string | null; alertEmail?: string | null;
}

/** Out-of-range thresholds read as "unset" rather than erroring — the form sends every
 *  field every time, and a blank one is how a threshold is removed. */
function inRange(value: unknown, [min, max]: readonly [number, number]): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

/**
 * The budgets document, or null when the form was left completely blank.
 *
 * Channels stand on their own: regression alerts need somewhere to send without any
 * threshold being set, so only a fully blank form clears the record.
 */
export function parseBudgets(body: BudgetsBody): { budgets: null } | { budgets: object } {
  let webhookUrl: string | null = null;
  if (typeof body.webhookUrl === 'string' && body.webhookUrl.trim()) {
    try {
      const parsed = new URL(body.webhookUrl.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol');
      webhookUrl = parsed.toString();
    } catch {
      throw new AppError(400, 'webhookUrl must be a valid http(s) URL');
    }
  }

  let alertEmail: string | null = null;
  if (typeof body.alertEmail === 'string' && body.alertEmail.trim()) {
    const email = body.alertEmail.trim();
    if (!EMAIL_RE.test(email)) throw new AppError(400, 'alertEmail must be a valid email address');
    alertEmail = email;
  }

  const budgets = {
    performance: inRange(body.performance, BUDGET_RANGE.performance),
    lcp:         inRange(body.lcp,         BUDGET_RANGE.lcp),
    tbt:         inRange(body.tbt,         BUDGET_RANGE.tbt),
    cls:         inRange(body.cls,         BUDGET_RANGE.cls),
    inp:         inRange(body.inp,         BUDGET_RANGE.inp),
    webhookUrl,
    alertEmail,
  };

  const noThresholds = budgets.performance == null && budgets.lcp == null &&
                       budgets.tbt == null && budgets.cls == null && budgets.inp == null;

  return noThresholds && !webhookUrl && !alertEmail ? { budgets: null } : { budgets };
}
