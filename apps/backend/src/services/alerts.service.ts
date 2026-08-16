import { Mailer } from './mailer.service.js';
import { AiService } from './ai.service.js';
import { postJson } from '../lib/http.js';
import { AlertLog, type IAlertDelivery } from '../models/AlertLog.model.js';
import type { IWebsite } from '../models/Website.model.js';

/**
 * One delivery path for every alert the backend raises, plus the policy that keeps it
 * from becoming noise. Channels are configured per-site on `budgets` — the thresholds
 * and the places to shout about them share a form, so they share a field.
 */

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Hard ceiling on the AI note.
 *
 * An alert is time-sensitive, so the commentary is allowed to make it late by at most this
 * much and can never stop it: the call is bounded and its failure resolves to `null`.
 */
const ALERT_NOTE_TIMEOUT_MS = 5000;

/**
 * How long a point-in-time alert suppresses repeats of the same metric on the same page.
 * A page whose LCP oscillates around the threshold would otherwise alert on every audit;
 * six hours is long enough to survive a nightly run and short enough that a genuinely new
 * problem the next morning still gets through.
 */
const EVENT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

type AlertStatus = 'firing' | 'recovered' | 'event';

export interface Alert {
  /** Short headline, e.g. "target missed". */
  kind:    string;
  /** Machine-readable event name, e.g. "budget.breach". */
  event:   string;
  /**
   * `firing` opens an incident and stays silent until it recovers — for conditions that
   * persist across runs, like a budget a site keeps missing. `recovered` closes one.
   * `event` is a point-in-time observation that cannot "resolve", like a regression
   * against the previous run; those are rate-limited instead.
   */
  status:  AlertStatus;
  /** The audited page. */
  url:     string;
  formFactor: string | null;
  /** Metric keys that tripped, used for dedup. */
  metrics: string[];
  /** One bullet per finding, already human-readable. */
  lines:   string[];
  analysisId?: string;
  /** Extra fields merged into the raw (non-Slack/Discord) webhook body. */
  payload: Record<string, unknown>;
}

/**
 * Slack and Discord incoming webhooks reject arbitrary JSON — they each need their own
 * envelope. Anything else receives the full structured payload.
 */
function webhookBody(
  webhookUrl: string, alert: Alert, site: { url: string; name: string }, aiNote: string | null,
): unknown {
  const icon  = alert.status === 'recovered' ? ':white_check_mark:' : ':warning:';
  const title = `${icon} PerfScope ${alert.kind} — ${site.name || site.url}`;
  const text  = `${title}\n${alert.url} (${alert.formFactor ?? 'desktop'})\n${alert.lines.map(l => `• ${l}`).join('\n')}`
    + (aiNote ? `\n\n${aiNote}` : '');

  try {
    const host = new URL(webhookUrl).hostname;
    if (host === 'hooks.slack.com') return { text };
    if (host.endsWith('discord.com') || host.endsWith('discordapp.com')) {
      return { content: text.replace(':warning:', '⚠️').replace(':white_check_mark:', '✅') };
    }
  } catch { /* fall through to the raw payload */ }

  return null;
}

async function postWebhook(webhookUrl: string, payload: unknown): Promise<void> {
  const res = await postJson(webhookUrl, payload, { timeoutMs: WEBHOOK_TIMEOUT_MS });
  // A 200 from Slack can still carry "invalid_payload"; surface the status either way.
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** Newest log entry for this page + event, whatever its status. */
async function lastEntry(site: IWebsite, alert: Alert) {
  return AlertLog
    .findOne({ websiteId: site._id, url: alert.url, event: baseEvent(alert.event) })
    .sort({ createdAt: -1 })
    .lean();
}

/** 'budget.recovered' and 'budget.breach' describe one incident, so they share a key. */
function baseEvent(event: string): string {
  return event.replace(/\.(recovered)$/, '.breach');
}

/**
 * Whether this alert is worth sending, given what has already gone out.
 *
 * - `firing`: only when no incident is currently open for this page.
 * - `recovered`: only when there is an open incident to close.
 * - `event`: only when the same metric has not alerted within the cooldown.
 */
async function shouldSend(site: IWebsite, alert: Alert): Promise<boolean> {
  const previous = await lastEntry(site, alert);

  if (alert.status === 'firing') {
    return !previous || previous.status !== 'firing';
  }

  if (alert.status === 'recovered') {
    return previous?.status === 'firing';
  }

  // Point-in-time: suppress only if every tripped metric is still inside its cooldown.
  if (!previous) return true;
  const age = Date.now() - new Date(previous.createdAt).getTime();
  if (age >= EVENT_COOLDOWN_MS) return true;
  return alert.metrics.some(m => !previous.metrics.includes(m));
}

/**
 * Fan an alert out to whichever channels the site has configured, then record what
 * happened. Never throws: a dead webhook or a misconfigured SMTP host must not fail the
 * audit that raised the alert.
 *
 * @returns whether anything was sent — false means policy suppressed it.
 */
export async function dispatchAlert(site: IWebsite, alert: Alert): Promise<boolean> {
  const channels = site.budgets;
  if (!channels?.webhookUrl && !channels?.alertEmail) return false;

  if (!(await shouldSend(site, alert))) {
    console.log(`[Alerts] Suppressed ${alert.event} for ${alert.url} (already notified)`);
    return false;
  }

  // After `shouldSend`, deliberately: suppressed alerts cost nothing, so the 6-hour
  // cooldown and the incident dedup rate-limit Gemini for free.
  const aiNote = await AiService
    .getAlertNote(
      { kind: alert.kind, url: alert.url, formFactor: alert.formFactor, lines: alert.lines },
      { timeoutMs: ALERT_NOTE_TIMEOUT_MS },
    )
    .catch((err: unknown) => {
      console.warn(`[Alerts] AI note failed (${alert.event}):`, err);
      return null;
    });

  const delivery: IAlertDelivery[] = [];

  if (channels.alertEmail && Mailer.isAvailable()) {
    const verb    = alert.status === 'recovered' ? 'recovered' : alert.kind;
    const subject = `PerfScope ${verb} — ${site.name || site.url}`;
    const text = `${alert.url} (${alert.formFactor ?? 'desktop'})\n\n` +
      alert.lines.map(l => `  • ${l}`).join('\n') +
      (aiNote ? `\n\n${aiNote}` : '');
    const html = `<p><b>${alert.url}</b> (${alert.formFactor ?? 'desktop'})</p>` +
      `<ul>${alert.lines.map(l => `<li>${l}</li>`).join('')}</ul>` +
      (aiNote ? `<p>${aiNote}</p>` : '');

    await Mailer.send(channels.alertEmail, subject, text, html)
      .then(() => delivery.push({ channel: 'email', ok: true, error: null }))
      .catch((err: unknown) => {
        console.warn(`[Alerts] Email failed (${alert.event}):`, err);
        delivery.push({ channel: 'email', ok: false, error: String((err as Error)?.message ?? err) });
      });
  }

  if (channels.webhookUrl) {
    const body = webhookBody(channels.webhookUrl, alert, site, aiNote) ?? {
      event:      alert.event,
      website:    { id: String(site._id), url: site.url, name: site.name },
      url:        alert.url,
      formFactor: alert.formFactor,
      at:         new Date().toISOString(),
      ...(aiNote ? { aiNote } : {}),
      ...alert.payload,
    };
    await postWebhook(channels.webhookUrl, body)
      .then(() => delivery.push({ channel: 'webhook', ok: true, error: null }))
      .catch((err: unknown) => {
        console.warn(`[Alerts] Webhook failed (${alert.event}):`, err);
        delivery.push({ channel: 'webhook', ok: false, error: String((err as Error)?.message ?? err) });
      });
  }

  // Logged even when every channel failed — the record is what makes a silent alert
  // debuggable, and it is also the state the next audit's dedup reads.
  await AlertLog.create({
    userId:     site.userId,
    websiteId:  site._id,
    url:        alert.url,
    // Stored under the incident key, not the message name: a breach and its recovery are
    // two states of one incident, and dedup reads the latest state of that series.
    event:      baseEvent(alert.event),
    status:     alert.status,
    metrics:    alert.metrics,
    analysisId: alert.analysisId ?? null,
    lines:      alert.lines,
    ...(aiNote ? { aiNote } : {}),
    delivery,
  }).catch((err: unknown) => console.warn('[Alerts] Could not record alert:', err));

  return true;
}
