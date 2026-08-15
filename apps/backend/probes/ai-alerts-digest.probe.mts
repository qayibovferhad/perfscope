/**
 * Exercises the two write-time AI surfaces that have no UI to click: the alert note and
 * the weekly digest paragraph.
 *
 * The webhook target is a throwaway HTTP server on localhost, so the payload can be read
 * back exactly as a real Slack/Discord/raw endpoint would receive it and nothing leaves
 * the machine.
 *
 * From apps/backend:
 *
 *     npx tsx probes/ai-alerts-digest.probe.mts
 *
 * What it must show:
 *   - the note rides in the raw JSON envelope and is stored on the alert log
 *   - the alert is still delivered when the note cannot be produced
 *   - the digest renders the paragraph after the greeting, and is unchanged without it
 */
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Website } from '../src/models/Website.model.js';
import { AlertLog } from '../src/models/AlertLog.model.js';
import { dispatchAlert, type Alert } from '../src/services/alerts.service.js';
import { renderDigest, type DigestData } from '../src/services/digest.service.js';
import { AiService } from '../src/services/ai.service.js';

const PORT = 3399;
const received: unknown[] = [];

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    try { received.push(JSON.parse(Buffer.concat(chunks).toString())); }
    catch { received.push(Buffer.concat(chunks).toString()); }
    res.writeHead(200).end('ok');
  });
});
await new Promise<void>((r) => server.listen(PORT, r));

await mongoose.connect(config.mongoUri);
const userId = new mongoose.Types.ObjectId();

const alert: Alert = {
  kind:   'budget breach',
  event:  'budget.breach',
  status: 'firing',
  url:    'https://probe.example/checkout',
  formFactor: 'mobile',
  metrics: ['lcp', 'performance'],
  lines:  ['LCP 4200ms (budget ≤ 2500ms)', 'Performance score 54 (budget ≥ 80)'],
  payload: { scores: { performance: 54 } },
};

/** A site whose only channel is the local receiver. One URL each — (userId, url) is unique. */
async function makeSite(webhookUrl: string, url: string) {
  return Website.create({
    userId: String(userId),
    url,
    name:   'AI probe site',
    budgets: { minPerformance: 80, maxLcp: 2500, webhookUrl },
  });
}

try {
  // ─── 1. Raw JSON envelope ──────────────────────────────────────────────────
  const raw = await makeSite(`http://localhost:${PORT}/raw`, 'https://probe.example');
  const sent = await dispatchAlert(raw, alert);
  await new Promise((r) => setTimeout(r, 300));

  const body = received.at(-1) as Record<string, unknown> | undefined;
  console.log(`raw webhook   · delivered: ${sent}`);
  console.log(`              · aiNote in payload: ${body?.['aiNote'] ? 'yes' : 'NO'}`);
  console.log(`                ${String(body?.['aiNote'] ?? '').slice(0, 150)}`);

  const logged = await AlertLog.findOne({ userId }).sort({ createdAt: -1 }).lean();
  console.log(`              · aiNote stored on AlertLog: ${logged?.['aiNote'] ? 'yes' : 'NO'}`);

  // ─── 2. A second site still alerts, and unknown hosts get the raw payload ──
  // Note: this does NOT exercise the Slack/Discord envelope. Those are chosen by hostname,
  // and pointing a probe at hooks.slack.com would mean posting to Slack for real. What it
  // does prove is that dedup is per site+url+event rather than global, so a second site
  // breaching the same budget is not swallowed as a repeat.
  const slack = await makeSite(`http://localhost:${PORT}/services/x`, 'https://probe2.example');
  await dispatchAlert(slack, { ...alert, url: 'https://probe2.example/checkout' });
  await new Promise((r) => setTimeout(r, 300));
  const second = received.at(-1) as Record<string, unknown> | undefined;
  console.log(`\nsecond site    · alerts independently, raw JSON envelope: ${second?.['event'] ? 'yes' : 'no'}`);
  console.log(`               · carries its own note: ${second?.['aiNote'] ? 'yes' : 'no'}`);

  // ─── 3. The note must never be able to hold up an alert ────────────────────
  const svc = AiService as unknown as { getAlertNote: unknown };
  const realNote = svc.getAlertNote;
  svc.getAlertNote = async () => { throw new Error('simulated Gemini outage'); };
  const third = await makeSite(`http://localhost:${PORT}/down`, 'https://probe3.example');
  const t0 = Date.now();
  const stillSent = await dispatchAlert(third, { ...alert, url: 'https://probe3.example/checkout' });
  svc.getAlertNote = realNote;
  await new Promise((r) => setTimeout(r, 300));
  const outage = received.at(-1) as Record<string, unknown> | undefined;
  console.log(`\nAI outage      · alert still delivered: ${stillSent} in ${Date.now() - t0}ms`);
  console.log(`               · payload carries no note: ${outage?.['aiNote'] === undefined ? 'correct' : 'LEAKED'}`);

  // ─── 4. Digest ─────────────────────────────────────────────────────────────
  const data: DigestData = {
    from: new Date('2026-08-07'), to: new Date('2026-08-14'),
    sites: 3, audits: 21, avgScore: 72, prevAvgScore: 78,
    regressions: 2, breaches: 1,
    slowest: [{ url: 'https://probe.example/checkout', score: 54, lcp: 4200 }],
  };

  const summary = await AiService.getDigestSummary({
    sites: data.sites, audits: data.audits,
    avgScore: data.avgScore, prevAvgScore: data.prevAvgScore,
    regressions: data.regressions, breaches: data.breaches,
    slowest: data.slowest,
  });
  console.log(`\ndigest summary · ${summary ? String(summary).slice(0, 160) : '(null)'}`);

  const withAi    = renderDigest('Ferhad', { ...data, aiSummary: summary ?? undefined });
  const withoutAi = renderDigest('Ferhad', data);
  const line3     = withAi.text.split('\n')[2];
  console.log(`               · paragraph sits after the greeting: ${line3 && line3 === summary ? 'yes' : `no (line 3 = ${JSON.stringify(line3)})`}`);
  console.log(`               · without it, unchanged: ${withoutAi.text.startsWith('Hi Ferhad,\n\nYour week') ? 'yes' : 'NO'}`);
  console.log(`               · html carries it: ${withAi.html.includes(String(summary).slice(0, 30)) ? 'yes' : 'NO'}`);
} finally {
  const w = await Website.deleteMany({ userId: String(userId) });
  const a = await AlertLog.deleteMany({ userId });
  console.log(`\ncleaned up ${w.deletedCount} site(s) and ${a.deletedCount} alert log(s)`);
  await mongoose.disconnect();
  server.close();
}
