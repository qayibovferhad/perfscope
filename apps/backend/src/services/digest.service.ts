import { hasResult, fmtMs, HAS_RESULT_FIELDS } from '@perfscope/shared';
import { User } from '../models/User.model.js';
import { Website } from '../models/Website.model.js';
import { HistoryModel } from '../models/History.model.js';
import { AlertLog } from '../models/AlertLog.model.js';
import { Mailer } from './mailer.service.js';

/**
 * Weekly summary of what happened across a user's sites.
 *
 * Alerts interrupt; a digest is read. It answers "how is the estate doing?" rather than
 * "what just broke", so it is scheduled, aggregated, and sent even when nothing is wrong.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Routes listed in the "slowest" table — enough to act on, short enough to scan. */
const SLOWEST_LIMIT = 5;

interface RouteRow {
  url:   string;
  score: number;
  lcp:   number;
}

export interface DigestData {
  from:   Date;
  to:     Date;
  sites:  number;
  audits: number;
  /** Mean performance across every successful audit this week, or null when none ran. */
  avgScore:     number | null;
  /** The same figure for the week before, for movement. */
  prevAvgScore: number | null;
  regressions:  number;
  breaches:     number;
  slowest:      RouteRow[];
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Mongo-side equivalent of hasResult, so a failed run never reaches the aggregation. */
const HAS_RESULT_FILTER = { $or: HAS_RESULT_FIELDS.map(field => ({ [field]: { $gt: 0 } })) };

export async function buildDigest(userId: string, now = new Date()): Promise<DigestData | null> {
  const to       = now;
  const from     = new Date(to.getTime() - WEEK_MS);
  const prevFrom = new Date(from.getTime() - WEEK_MS);

  const siteCount = await Website.countDocuments({ userId });
  if (siteCount === 0) return null;   // nothing to report on

  const [thisWeek, lastWeek, regressions, breaches] = await Promise.all([
    HistoryModel.find({ userId, createdAt: { $gte: from, $lte: to }, ...HAS_RESULT_FILTER })
      .select('url scores metrics createdAt').lean(),
    HistoryModel.find({ userId, createdAt: { $gte: prevFrom, $lt: from }, ...HAS_RESULT_FILTER })
      .select('scores').lean(),
    AlertLog.countDocuments({ userId, event: 'audit.regression', createdAt: { $gte: from, $lte: to } }),
    AlertLog.countDocuments({ userId, event: 'budget.breach', status: 'firing', createdAt: { $gte: from, $lte: to } }),
  ]);

  // Slowest routes use each page's most recent run, not its worst — the digest should
  // describe the estate as it stands now.
  const latestByUrl = new Map<string, RouteRow>();
  for (const doc of [...thisWeek].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))) {
    if (!hasResult(doc)) continue;
    latestByUrl.set(doc.url, {
      url:   doc.url,
      score: Math.round(doc.scores.performance),
      lcp:   doc.metrics.lcp,
    });
  }

  const slowest = [...latestByUrl.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, SLOWEST_LIMIT);

  return {
    from, to,
    sites:        siteCount,
    audits:       thisWeek.length,
    avgScore:     mean(thisWeek.map(d => d.scores.performance)),
    prevAvgScore: mean(lastWeek.map(d => d.scores.performance)),
    regressions,
    breaches,
    slowest,
  };
}

function movement(current: number | null, previous: number | null): string {
  if (current == null) return 'no audits ran';
  if (previous == null) return `${current} (no baseline last week)`;
  const delta = current - previous;
  if (delta === 0) return `${current} (unchanged)`;
  return `${current} (${delta > 0 ? '+' : ''}${delta} vs last week)`;
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function renderDigest(name: string, data: DigestData): { subject: string; text: string; html: string } {
  const window  = `${fmtDay(data.from)} – ${fmtDay(data.to)}`;
  const subject = `PerfScope weekly — ${movement(data.avgScore, data.prevAvgScore).split(' ')[0]} avg across ${data.sites} site${data.sites === 1 ? '' : 's'}`;

  const headline = [
    `Sites tracked:      ${data.sites}`,
    `Audits run:         ${data.audits}`,
    `Average score:      ${movement(data.avgScore, data.prevAvgScore)}`,
    `Regressions:        ${data.regressions}`,
    `Budget breaches:    ${data.breaches}`,
  ];

  const slowLines = data.slowest.length
    ? data.slowest.map(r => `  ${String(r.score).padStart(3)}  ${fmtMs(r.lcp).padStart(8)}  ${r.url}`)
    : ['  (no successful audits this week)'];

  const text = [
    `Hi ${name || 'there'},`,
    '',
    `Your week on PerfScope, ${window}:`,
    '',
    ...headline,
    '',
    'Slowest pages (latest run):',
    '  SCORE       LCP  URL',
    ...slowLines,
    '',
    'Sent because weekly digests are enabled on your account.',
  ].join('\n');

  const rows = data.slowest.length
    ? data.slowest.map(r =>
        `<tr><td style="padding:4px 12px 4px 0"><b>${r.score}</b></td>` +
        `<td style="padding:4px 12px 4px 0">${fmtMs(r.lcp)}</td>` +
        `<td style="padding:4px 0;color:#555">${r.url}</td></tr>`).join('')
    : '<tr><td colspan="3" style="color:#888">No successful audits this week.</td></tr>';

  const html = [
    `<p>Hi ${name || 'there'},</p>`,
    `<p>Your week on PerfScope, <b>${window}</b>:</p>`,
    '<ul>',
    `<li>Sites tracked: <b>${data.sites}</b></li>`,
    `<li>Audits run: <b>${data.audits}</b></li>`,
    `<li>Average score: <b>${movement(data.avgScore, data.prevAvgScore)}</b></li>`,
    `<li>Regressions: <b>${data.regressions}</b></li>`,
    `<li>Budget breaches: <b>${data.breaches}</b></li>`,
    '</ul>',
    '<p><b>Slowest pages</b> (latest run)</p>',
    `<table style="font-family:ui-monospace,monospace;font-size:13px;border-collapse:collapse">${rows}</table>`,
    '<p style="color:#888;font-size:12px">Sent because weekly digests are enabled on your account.</p>',
  ].join('');

  return { subject, text, html };
}

/** @returns whether an email was actually sent. */
export async function sendDigest(userId: string, now = new Date()): Promise<boolean> {
  if (!Mailer.isAvailable()) return false;

  const user = await User.findById(userId).lean();
  if (!user?.email) return false;

  const data = await buildDigest(userId, now);
  if (!data) return false;

  const { subject, text, html } = renderDigest(user.name ?? '', data);
  await Mailer.send(user.email, subject, text, html);
  await User.updateOne({ _id: userId }, { 'digest.lastSentAt': now }).catch(() => {});

  console.log(`[Digest] Sent to ${user.email} (${data.audits} audits, avg ${data.avgScore ?? 'n/a'})`);
  return true;
}

/**
 * Every user whose digest is due at this minute. Matched on day + HH:MM the same way
 * nightly audits are, and guarded by lastSentAt so a restart inside the same minute
 * cannot send twice.
 */
export async function runDueDigests(now = new Date()): Promise<void> {
  const day  = now.getDay();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const due = await User.find({ 'digest.enabled': true, 'digest.day': day, 'digest.time': time })
    .select('_id digest').lean();

  for (const user of due) {
    const last = user.digest?.lastSentAt;
    if (last && now.getTime() - new Date(last).getTime() < WEEK_MS / 2) continue;

    await sendDigest(String(user._id), now)
      .catch((err: unknown) => console.warn('[Digest] Failed for', String(user._id), err));
  }
}
