/**
 * Three demo alerts for the notification bell, and the one command that removes them.
 *
 * The bell reads `AlertLog`, which is only written when a real audit misses a target or
 * regresses — so a healthy account has an empty bell and nothing to look at. This puts
 * something there.
 *
 *   node scripts/demo-alerts.mjs            # add three, marked as unread
 *   node scripts/demo-alerts.mjs --remove   # take them away again
 *
 * Everything it writes carries `demo: true`, and --remove deletes exactly that.
 */
import { MongoClient, ObjectId } from 'mongodb';

const URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/perfscope';
const EMAIL = process.env.EMAIL;

const client = new MongoClient(URI);
await client.connect();
const db = client.db();

const user = EMAIL
  ? await db.collection('users').findOne({ email: EMAIL })
  : await db.collection('users').findOne({ email: { $not: /e2e-test/ } });

if (!user) {
  console.error(EMAIL ? `No account with email ${EMAIL}` : 'No account found — sign up first.');
  await client.close();
  process.exit(1);
}

if (process.argv.includes('--remove')) {
  const { deletedCount } = await db.collection('alertlogs').deleteMany({ userId: user._id, demo: true });
  console.log(`Removed ${deletedCount} demo alert(s) from ${user.email}.`);
  await client.close();
  process.exit(0);
}

const site = await db.collection('websites').findOne({ userId: user._id });
if (!site) {
  console.error('No website on this account — add one first, the alerts hang off it.');
  await client.close();
  process.exit(1);
}

const url = `${site.url.replace(/\/+$/, '')}/pricing`;
const alerts = [
  { event: 'budget.breach',    status: 'firing',    metrics: ['lcp'],         lines: ['LCP 4.6 s, up from 2.1 s (+119%)', 'Added: vendor-analytics.js (310KB)'], minutesAgo: 4,
    aiNote: 'The analytics bundle you added last night is parsed before the hero image starts loading, which is what moved LCP.' },
  { event: 'audit.regression', status: 'event',     metrics: ['performance'], lines: ['Performance 58, down from 91'], minutesAgo: 55 },
  { event: 'budget.recovered', status: 'recovered', metrics: ['lcp'],         lines: ['LCP back under 2.5 s'], minutesAgo: 26 * 60 },
];

await db.collection('alertlogs').insertMany(alerts.map(a => ({
  userId: user._id, websiteId: site._id, url,
  event: a.event, status: a.status, metrics: a.metrics, lines: a.lines,
  ...(a.aiNote ? { aiNote: a.aiNote } : {}),
  analysisId: null, delivery: [], demo: true,
  createdAt: new Date(Date.now() - a.minutesAgo * 60_000),
})));

// The badge counts alerts raised since the account last opened the bell — so an account
// that has opened it before would see these as already read.
await db.collection('users').updateOne({ _id: user._id }, { $set: { alertsSeenAt: null } });

console.log(`Added ${alerts.length} demo alerts to ${user.email} (${url}).`);
console.log('The bell should show a red 3. Remove them with: node scripts/demo-alerts.mjs --remove');
await client.close();
