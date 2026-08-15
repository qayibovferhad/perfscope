/**
 * Probe: can one account's audit delete another account's history?
 *
 * `HistoryService.save` caps how many audits it keeps per URL. That cap used to be applied
 * with a filter of `{ normalizedUrl, source }` and nothing else, so two accounts auditing
 * the same public URL shared one allowance of ten — and every save by either of them
 * deleted the other's oldest rows. The delete is by `_id` and its count is discarded, so
 * nothing anywhere reported it.
 *
 * This fills one account to the cap, then has a *second* account audit the same URL, and
 * counts what the first account has left. Before the fix it loses a row on every save.
 *
 * From apps/backend:
 *
 *     npx tsx probes/history-prune.probe.mts
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { HistoryModel } from '../src/models/History.model.js';
import { HistoryService } from '../src/services/history.service.js';

const URL = 'https://prune-probe.example/pricing';
const CAP = 10;

await mongoose.connect(config.mongoUri);

const alice = new mongoose.Types.ObjectId().toString();
const bob   = new mongoose.Types.ObjectId().toString();

const entry = (n: number) => ({
  id:        `prune-probe-${n}-${Math.random().toString(16).slice(2)}`,
  shortId:   `pp${n}`.slice(0, 7),
  url:       URL,
  timestamp: new Date().toISOString(),
  scores:    { performance: 50 + n, accessibility: 90, bestPractices: 90, seo: 90 },
  metrics:   { fcp: 1000, lcp: 2000, tbt: 100, cls: 0.05, si: 1500, tti: 2500 },
});

const countFor = (userId: string) => HistoryModel.countDocuments({ userId, url: URL });

try {
  // Alice fills her allowance exactly.
  for (let i = 0; i < CAP; i++) await HistoryService.save(entry(i), alice, undefined);
  console.log(`alice at the cap        : ${await countFor(alice)} audits`);

  // Bob now audits the same public URL three times. Nothing he does should touch her rows.
  for (let i = 0; i < 3; i++) await HistoryService.save(entry(100 + i), bob, undefined);

  const aliceLeft = await countFor(alice);
  const bobHas    = await countFor(bob);
  console.log(`after bob audits ×3     : alice ${aliceLeft}, bob ${bobHas}`);
  console.log(aliceLeft === CAP
    ? `\n  PASS — alice kept all ${CAP}; the cap is per owner.`
    : `\n  FAIL — alice lost ${CAP - aliceLeft} audit(s) to bob's saves.`);

  // The cap must still work *within* one account, or the fix has just disabled it.
  for (let i = 0; i < 4; i++) await HistoryService.save(entry(200 + i), alice, undefined);
  const aliceAfterOwn = await countFor(alice);
  console.log(`\nalice audits ×4 more    : ${aliceAfterOwn} audits`);
  console.log(aliceAfterOwn === CAP
    ? `  PASS — still capped at ${CAP} for her own runs.`
    : `  FAIL — cap is not being applied (expected ${CAP}).`);

  // Anonymous saves have no userId at all; they must not reach an account either.
  for (let i = 0; i < CAP + 3; i++) await HistoryService.save(entry(300 + i), undefined, undefined);
  const anon = await HistoryModel.countDocuments({ userId: { $exists: false }, url: URL });
  console.log(`\nanonymous saves ×${CAP + 3}     : ${anon} kept, alice still ${await countFor(alice)}`);
  console.log(anon === CAP && (await countFor(alice)) === CAP
    ? '  PASS — anonymous rows prune among themselves.'
    : '  FAIL — anonymous pruning crossed an owner boundary.');
} finally {
  const { deletedCount } = await HistoryModel.deleteMany({ url: URL });
  console.log(`\ncleaned up ${deletedCount} probe row(s)`);
  await mongoose.disconnect();
}
