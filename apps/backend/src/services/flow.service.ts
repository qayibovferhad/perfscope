/**
 * Running a user flow.
 *
 * Lighthouse's flow API drives a Puppeteer page we own: navigate once, then measure each
 * interaction inside its own timespan, then take a snapshot of whatever state the flow
 * left behind. Everything else in this file exists to make that safe — the concurrency cap,
 * the timeout, the reaped Chrome, the session injection.
 *
 * **Each measured step gets its own timespan.** One timespan around the whole flow would
 * report a single INP for five interactions and could not say which one was slow — which is
 * the only question this feature exists to answer. The cost is a gather per step; a
 * timespan gather is cheap (it ends when we say so, with none of the quiet-window waiting a
 * navigation does — see the audit-speed notes).
 *
 * **It shares the audit queue.** A flow owns a Chrome for its whole duration, and a
 * Lighthouse run that loses CPU does not merely take longer, it reports worse numbers. A
 * flow measuring INP while two audits fight it for cores is not a measurement.
 */
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { startFlow } from 'lighthouse';
import { v4 as uuidv4 } from 'uuid';
import { describeFlowStep, type FlowDefinition, type FlowProgress, type FlowRunResult, type FlowStep } from '@perfscope/shared';
import { CHROME_ARGS } from '../lib/chrome.js';
import { trackChrome, killChrome } from '../lib/chromeReaper.js';
import { auditQueue } from './lighthouse.service.js';
import { buildFlowStepResult } from './flow-transform.js';
import { AppError } from '../lib/errors.js';
import type { AuthSessionData } from './authAuditSession.js';

/**
 * A whole flow, capped.
 *
 * Longer than a single audit's four minutes because a flow is several gathers plus the
 * waiting between them, and short enough that a selector which never appears cannot hold a
 * Chrome for the afternoon. Individual steps have their own, much shorter, waits.
 */
const FLOW_TIMEOUT_MS = 6 * 60_000;

/** How long a single step may wait for its selector before the flow gives up on it. */
const STEP_TIMEOUT_MS = 10_000;

/** Settle time after an interaction, inside its own timespan — see settleAfterInteraction. */
const INTERACTION_SETTLE_MS = 200;

/** Emulation matching the analyzer's, so a flow's numbers sit beside an audit's. */
const VIEWPORT = {
  mobile:  { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true,  hasTouch: true },
  desktop: { width: 1350, height: 940, deviceScaleFactor: 1,    isMobile: false, hasTouch: false },
};

export interface FlowRunOptions {
  onProgress?: (progress: Omit<FlowProgress, 'flowRunId'>) => void;
  /** A saved session for this origin, injected before the first navigation — flows live
   *  behind logins more often than cold pages do. */
  session?: AuthSessionData | null;
}

type Definition = Pick<FlowDefinition, 'name' | 'url' | 'steps' | 'snapshotAtEnd' | 'formFactor'>;

/** Perform one step against the page. Throws with the step named, so the client can say
 *  which selector never showed up rather than "the flow failed". */
async function performStep(page: Page, step: FlowStep): Promise<void> {
  const timeout = STEP_TIMEOUT_MS;
  switch (step.action) {
    case 'click':
      await page.waitForSelector(step.selector!, { timeout, visible: true });
      await page.click(step.selector!);
      break;
    case 'hover':
      await page.waitForSelector(step.selector!, { timeout, visible: true });
      await page.hover(step.selector!);
      break;
    case 'type':
      await page.waitForSelector(step.selector!, { timeout, visible: true });
      // `type` rather than `page.$eval(el => el.value = …)`: a React form listens for the
      // keystrokes, and a value assigned straight onto the element leaves its state empty.
      await page.type(step.selector!, step.value ?? '');
      break;
    case 'press':
      await page.keyboard.press(step.value as Parameters<Page['keyboard']['press']>[0]);
      break;
    case 'scroll': {
      // Evaluated as source rather than as a callback: this file is typechecked without the
      // DOM lib (the backend has no browser globals), and the injected-session path next
      // door hands Chrome a string for the same reason.
      const by = Number(step.value);
      const top = Number.isFinite(by) ? String(by) : 'document.body.scrollHeight';
      await page.evaluate(`window.scrollBy({ top: ${top}, behavior: 'instant' })`);
      break;
    }
    case 'waitFor':
      await page.waitForSelector(step.selector!, { timeout, visible: true });
      break;
    case 'wait':
      await new Promise((resolve) => setTimeout(resolve, Number(step.value) || 1000));
      break;
    case 'navigate':
      await page.goto(step.value!, { waitUntil: 'networkidle2', timeout: FLOW_TIMEOUT_MS / 4 });
      break;
  }
}

/**
 * Actions that are an interaction — the ones INP is defined over.
 *
 * A wait or a navigation is not something a user "did" to the page in the sense the metric
 * means, and pausing after them would only make the flow slower.
 */
const INTERACTIONS = new Set(['click', 'type', 'press', 'hover', 'scroll']);

/**
 * Let the interaction finish before the timespan closes.
 *
 * This is the difference between the feature working and not: `page.click()` resolves as
 * soon as the event is dispatched, so ending the timespan straight after it cuts the window
 * off *before the next paint* — and INP is defined as input to next paint. Measured: without
 * this the probe's 300ms-blocking button reported no INP at all; with it, ~330ms.
 *
 * Two animation frames guarantee a paint has actually happened; the short settle afterwards
 * catches work the handler kicked off just after it.
 */
async function settleAfterInteraction(page: Page): Promise<void> {
  await page.evaluate(
    `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, ${INTERACTION_SETTLE_MS}))))`,
  ).catch(() => {});
}

/** Cookies and localStorage, before anything loads — the same sequence the audit path uses. */
async function injectSession(page: Page, session: AuthSessionData): Promise<void> {
  if (session.cookies?.length) {
    await page.setCookie(...(session.cookies as Parameters<Page['setCookie']>[0][])).catch(() => {});
  }
  const entries = Object.entries(session.localStorage ?? {});
  if (entries.length) {
    await page.evaluateOnNewDocument((pairs: [string, string][]) => {
      for (const [key, value] of pairs) {
        try { localStorage.setItem(key, value); } catch { /* quota — skip */ }
      }
    }, entries);
  }
}

/**
 * Run a definition and return the report.
 *
 * The whole thing races a timeout that kills the browser, because the failure mode here is
 * not an exception — it is a `waitForSelector` on a page that will never change, and a
 * promise that never settles takes an audit slot with it.
 */
export async function runFlow(definition: Definition, opts: FlowRunOptions = {}): Promise<FlowRunResult> {
  return auditQueue.run(
    () => executeFlow(definition, opts),
    {
      priority: 'interactive',
      onQueue: (position) => opts.onProgress?.({
        step: -1,
        total: definition.steps.length,
        message: `Waiting for a free slot — ${position} ahead`,
        percent: 2,
      }),
    },
  );
}

async function executeFlow(definition: Definition, opts: FlowRunOptions): Promise<FlowRunResult> {
  const started = Date.now();
  const measured = definition.steps.filter((s) => s.measure !== false);
  // Steps + the opening navigation + the closing snapshot: the denominator the progress bar
  // divides by, so it cannot claim 100% while a snapshot is still gathering.
  const totalGathers = measured.length + 1 + (definition.snapshotAtEnd ? 1 : 0);
  let gathered = 0;

  const say = (message: string, step: number) => {
    opts.onProgress?.({
      step,
      total: definition.steps.length,
      message,
      // Held below 99 until the result exists, for the same reason the audit's own scale is.
      percent: Math.min(99, Math.round((gathered / totalGathers) * 96) + 3),
    });
  };

  let browser: Browser | undefined;
  let untrack: (() => void) | undefined;

  const run = async (): Promise<FlowRunResult> => {
    browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
    untrack = trackChrome(browser.process()?.pid);

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT[definition.formFactor === 'mobile' ? 'mobile' : 'desktop']);
    if (opts.session) await injectSession(page, opts.session);

    const flow = await startFlow(page, {
      name: definition.name,
      flags: { formFactor: definition.formFactor === 'mobile' ? 'mobile' : 'desktop', screenEmulation: { disabled: true } },
    });

    say('Loading the page', -1);
    await flow.navigate(definition.url);
    gathered++;

    for (const [index, step] of definition.steps.entries()) {
      const label = step.name || describeFlowStep(step);

      // An unmeasured step is plumbing — a cookie banner, a field to fill — and runs
      // outside any timespan so it cannot contribute its own cost to a neighbour's number.
      if (step.measure === false) {
        say(`${label} (not measured)`, index);
        await performStep(page, step).catch((err) => { throw stepError(index, label, err); });
        continue;
      }

      say(label, index);
      await flow.startTimespan({ name: label });
      try {
        await performStep(page, step);
        // Inside the timespan, deliberately: the response to the interaction is the thing
        // being measured.
        if (INTERACTIONS.has(step.action)) await settleAfterInteraction(page);
      } catch (err) {
        // End the timespan before throwing: Lighthouse holds a CDP session open across it,
        // and abandoning one leaves the browser in a state its own teardown trips over.
        await flow.endTimespan().catch(() => {});
        throw stepError(index, label, err);
      }
      await flow.endTimespan();
      gathered++;
    }

    if (definition.snapshotAtEnd) {
      say('Auditing the final state', definition.steps.length);
      await flow.snapshot({ name: 'Final state' });
      gathered++;
    }

    const flowResult = await flow.createFlowResult();

    // The definition's actions are echoed onto the report so it reads on its own, without
    // the flow definition open beside it. Navigation and snapshot have no action.
    const actions = [undefined, ...measured.map((s) => s.name || describeFlowStep(s)), undefined];

    return {
      id: uuidv4(),
      flowId: '',
      name: definition.name,
      url: definition.url,
      formFactor: definition.formFactor === 'mobile' ? 'mobile' : 'desktop',
      timestamp: new Date().toISOString(),
      steps: flowResult.steps.map((step, i) => buildFlowStepResult(step, actions[i])),
      durationMs: Date.now() - started,
    };
  };

  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AppError(504, 'The flow took too long and was stopped')), FLOW_TIMEOUT_MS)),
    ]);
  } finally {
    // Killed rather than closed, and by pid: a Chrome mid-gather does not always let go of
    // `browser.close()`, and a leaked one holds an audit slot's worth of CPU.
    const pid = browser?.process()?.pid;
    await browser?.close().catch(() => {});
    killChrome(pid);
    untrack?.();
  }
}

/** A step failure that names itself — "waiting for #checkout never matched" beats "failed". */
function stepError(index: number, label: string, err: unknown): AppError {
  const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
  const error = new AppError(422, `Step ${index + 1} (${label}) failed: ${reason}`);
  (error as AppError & { step?: number }).step = index;
  return error;
}
