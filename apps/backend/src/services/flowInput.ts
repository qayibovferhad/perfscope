/**
 * Validating a flow definition.
 *
 * A flow is a small program somebody typed, and this server executes it against a browser
 * it owns — so it is checked the way input that becomes behaviour has to be checked, and
 * rejected rather than quietly repaired. A step with no selector does not "just not click";
 * it makes a flow that looks configured and measures the wrong thing.
 */
import { MAX_FLOW_STEPS, type FlowActionKind, type FlowStep } from '@perfscope/shared';
import { AppError } from '../lib/errors.js';
import { isValidUrl } from '../lib/url.js';

const ACTIONS: FlowActionKind[] = ['click', 'type', 'press', 'hover', 'scroll', 'waitFor', 'wait', 'navigate'];

/** Actions that point at an element and cannot work without knowing which. */
const NEEDS_SELECTOR: FlowActionKind[] = ['click', 'type', 'hover', 'waitFor'];

/** Actions whose value carries the whole instruction. */
const NEEDS_VALUE: FlowActionKind[] = ['type', 'press', 'navigate'];

const MAX_NAME = 80;
const MAX_SELECTOR = 300;
const MAX_VALUE = 500;

/** A single wait, capped: a flow that sleeps a minute is a flow holding a Chrome hostage. */
const MAX_WAIT_MS = 15_000;

export interface FlowBody {
  name?:  unknown;
  url?:   unknown;
  steps?: unknown;
  snapshotAtEnd?: unknown;
  formFactor?: unknown;
  websiteId?: unknown;
}

function parseStep(raw: unknown, index: number): FlowStep {
  const where = `Step ${index + 1}`;
  if (!raw || typeof raw !== 'object') throw new AppError(400, `${where} is not a step`);

  const step = raw as Record<string, unknown>;
  const action = step['action'];
  if (typeof action !== 'string' || !ACTIONS.includes(action as FlowActionKind)) {
    throw new AppError(400, `${where}: action must be one of ${ACTIONS.join(', ')}`);
  }
  const kind = action as FlowActionKind;

  const selector = typeof step['selector'] === 'string' ? step['selector'].trim() : '';
  const value    = typeof step['value']    === 'string' ? step['value'].trim()    : '';

  if (NEEDS_SELECTOR.includes(kind) && !selector) {
    throw new AppError(400, `${where}: ${kind} needs a CSS selector`);
  }
  if (NEEDS_VALUE.includes(kind) && !value) {
    throw new AppError(400, `${where}: ${kind} needs a value`);
  }
  if (selector.length > MAX_SELECTOR) throw new AppError(400, `${where}: selector is too long`);
  if (value.length > MAX_VALUE)       throw new AppError(400, `${where}: value is too long`);

  if (kind === 'wait') {
    const ms = Number(value || '1000');
    if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_WAIT_MS) {
      throw new AppError(400, `${where}: wait must be between 1 and ${MAX_WAIT_MS} ms`);
    }
  }

  if (kind === 'navigate' && !isValidUrl(value)) {
    // A flow's navigate is a second URL this server will fetch, so it is held to the same
    // bar as the first one. The private-network guard runs at execution time (lib/ssrf).
    throw new AppError(400, `${where}: navigate needs an http(s) URL`);
  }

  const name = typeof step['name'] === 'string' ? step['name'].trim().slice(0, MAX_NAME) : '';

  return {
    action: kind,
    ...(selector ? { selector } : {}),
    ...(value ? { value } : {}),
    ...(name ? { name } : {}),
    // Absent means measured. Only an explicit `false` turns a step into plumbing.
    measure: step['measure'] !== false,
  };
}

/** The definition to store, or the AppError the client should see. */
export function parseFlowInput(body: FlowBody) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new AppError(400, 'name is required');
  if (name.length > MAX_NAME) throw new AppError(400, `name must be ${MAX_NAME} characters or fewer`);

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!isValidUrl(url)) throw new AppError(400, 'url must start with http:// or https://');

  if (!Array.isArray(body.steps)) throw new AppError(400, 'steps must be an array');
  if (body.steps.length === 0) {
    // A flow with no steps is a navigation audit wearing a costume, and the analyzer
    // already does that better.
    throw new AppError(400, 'A flow needs at least one step — otherwise it is just an audit');
  }
  if (body.steps.length > MAX_FLOW_STEPS) {
    throw new AppError(400, `At most ${MAX_FLOW_STEPS} steps`);
  }

  const steps = body.steps.map(parseStep);

  return {
    name,
    url,
    steps,
    snapshotAtEnd: body.snapshotAtEnd !== false,
    formFactor: body.formFactor === 'mobile' ? ('mobile' as const) : ('desktop' as const),
    ...(typeof body.websiteId === 'string' && /^[a-f\d]{24}$/i.test(body.websiteId)
      ? { websiteId: body.websiteId }
      : {}),
  };
}
