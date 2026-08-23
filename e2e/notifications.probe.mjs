/**
 * Two things the app had no way to say: "that worked" and "something happened while you
 * were away".
 *
 * The toaster is written from scratch — no library — so the things a library would have
 * got right are exactly what has to be checked here: that a toast appears and then leaves
 * on its own, that hovering stops the clock instead of only stopping the bar, that a
 * loading toast becomes its own result rather than stacking a second card, that the stack
 * is capped, and that it is announced to a screen reader.
 *
 * The bell is checked against seeded alerts: the badge counts what is unread, opening it
 * clears the badge, and the count survives a reload because "unread" is a timestamp on the
 * account rather than state in the tab.
 *
 *   node e2e/notifications.probe.mjs [outDir]
 */
import { mkdirSync } from 'node:fs';
import { MongoClient, ObjectId } from 'mongodb';
import {
  WEB_URL, MONGODB_URI, registerUser, cleanupUser, launchAuthedBrowser,
  waitForServers, sleep, bodyText,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-notifications';
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** Raise a toast from the page, the same way application code does. */
const raise = (page, kind, title, options = {}) =>
  page.evaluate((k, t, o) => window.__toast[k](t, o), kind, title, options);

const toastCount = (page) => page.$$eval('.ps-toast', (els) => els.length);
const toastText  = (page) => page.$$eval('.ps-toast', (els) => els.map((e) => e.innerText.replace(/\n/g, ' · ')));

await waitForServers();
const { token, user, email } = await registerUser();
const userId = String(user.sub ?? user.id ?? user._id);

// Three alerts and a site to hang them on, so the bell has something real to count.
const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
await mongo.connect();
const db = mongo.db();
const websiteId = new ObjectId();
await db.collection('websites').insertOne({
  _id: websiteId, userId: new ObjectId(userId), url: 'https://alerts.probe.test',
  name: 'alerts probe', createdAt: new Date(), updatedAt: new Date(),
});
await db.collection('alertlogs').insertMany(
  [
    { event: 'budget.breach',    status: 'firing',    metrics: ['lcp'],         lines: ['LCP 4.6 s, up from 2.1 s (+119%)'], minutesAgo: 5 },
    { event: 'audit.regression', status: 'event',     metrics: ['performance'], lines: ['Performance 58, down from 91'],      minutesAgo: 40 },
    { event: 'budget.recovered', status: 'recovered', metrics: ['lcp'],         lines: ['LCP back under 2.5 s'],              minutesAgo: 90 },
  ].map((a) => ({
    userId: new ObjectId(userId), websiteId, url: 'https://alerts.probe.test/pricing',
    event: a.event, status: a.status, metrics: a.metrics, lines: a.lines,
    analysisId: null, delivery: [], createdAt: new Date(Date.now() - a.minutesAgo * 60_000),
  })),
);
await mongo.close();

const { browser, page, errors } = await launchAuthedBrowser({ user, token });

try {
  await page.goto(`${WEB_URL}/dashboard`, { waitUntil: 'networkidle0' });
  await sleep(1500);

  // The toast API is a module function, not a hook — expose it so the probe raises toasts
  // through exactly the path application code uses.
  await page.evaluate(async () => {
    const mod = await import('/src/shared/ui/toast/index.ts');
    window.__toast = mod.toast;
  });

  // ─── It appears, it is announced, it leaves ────────────────────────────────
  await raise(page, 'success', 'Saved', { description: 'Everything went through.' });
  await sleep(400);
  check(await toastCount(page) === 1, 'a toast appears');
  check(/Saved/.test((await toastText(page)).join(' ')), 'carrying its title');
  check(/Everything went through/.test((await toastText(page)).join(' ')), 'and its description');

  const live = await page.$eval('.ps-toast', (el) => {
    const region = el.closest('[aria-live]');
    return { region: region?.getAttribute('aria-live') ?? null, role: el.getAttribute('role') };
  });
  check(live.region === 'polite', `it sits in a polite live region (${live.region})`);
  check(live.role === 'status', `and is a status, not an alert (${live.role})`);
  await page.screenshot({ path: `${OUT}/toast-success.png` });

  await raise(page, 'error', 'Audit failed', { description: 'The page never responded.' });
  await sleep(300);
  const errRole = await page.$$eval('.ps-toast', (els) => els.map((e) => e.getAttribute('role')));
  check(errRole.includes('alert'), 'an error is an alert, which screen readers interrupt for');

  // ─── The countdown is the bar ──────────────────────────────────────────────
  await raise(page, 'info', 'Short lived', { duration: 900 });
  await sleep(1500);
  check(!(await toastText(page)).some((t) => /Short lived/.test(t)), 'a toast dismisses itself when its time is up');

  // Hovering has to stop the dismissal, not just the animation — the bar *is* the timer.
  // Cleared first so the card under the cursor is unambiguously the one under test: the
  // earlier toasts are still on screen and the pointer would land on whichever is topmost.
  await page.evaluate(() => window.__toast.clear());
  await sleep(300);
  await raise(page, 'info', 'Hovered', { duration: 1000 });
  await sleep(200);
  const box = await page.$eval('.ps-toast', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  await sleep(300);
  const playState = await page.$eval('.ps-toast-bar', (el) => getComputedStyle(el).animationPlayState);
  check(playState === 'paused', `the countdown is paused while hovered (${playState})`);
  await sleep(1900);
  check((await toastText(page)).some((t) => /Hovered/.test(t)), 'so the toast is still there long past its duration');
  await page.mouse.move(5, 5);
  await sleep(1600);
  check(!(await toastText(page)).some((t) => /Hovered/.test(t)), 'and moving away lets it finish');

  // ─── One event, one card ───────────────────────────────────────────────────
  await page.evaluate(() => window.__toast.clear());
  await sleep(300);
  await page.evaluate(() => { window.__id = window.__toast.loading('Running audit…'); });
  await sleep(300);
  check(await toastCount(page) === 1, 'a loading toast is one card');
  await sleep(1200);
  check(await toastCount(page) === 1, 'and it does not time out — the work decides when it ends');
  await page.evaluate(() => window.__toast.success('Audit complete', { id: window.__id }));
  await sleep(400);
  const promoted = await toastText(page);
  check(await toastCount(page) === 1, 'promoting it updates that card rather than stacking a second');
  check(/Audit complete/.test(promoted.join(' ')) && !/Running audit/.test(promoted.join(' ')),
    'and the card now reads as the result');

  // ─── The stack is capped ───────────────────────────────────────────────────
  await page.evaluate(() => window.__toast.clear());
  await sleep(300);
  await page.evaluate(() => {
    for (let i = 1; i <= 7; i++) window.__toast.info(`Stacked ${i}`, { duration: 30000 });
  });
  await sleep(600);
  const stacked = await toastCount(page);
  check(stacked === 4, `at most four are on screen at once (${stacked})`);
  const kept = (await toastText(page)).join(' ');
  check(/Stacked 7/.test(kept) && !/Stacked 1\b/.test(kept), 'the newest survive and the oldest is dropped');
  await page.screenshot({ path: `${OUT}/toast-stack.png` });

  // ─── Dismissing by hand ────────────────────────────────────────────────────
  const before = await toastCount(page);
  await page.click('.ps-toast button[aria-label="Dismiss notification"]');
  await sleep(500);
  check(await toastCount(page) === before - 1, 'the close button removes one');
  await page.evaluate(() => window.__toast.clear());
  await sleep(400);

  // ─── The bell ──────────────────────────────────────────────────────────────
  const badge = await page.$eval('button[aria-label^="Notifications"]', (el) => el.getAttribute('aria-label'));
  console.log(`  bell: ${badge}`);
  check(/3 unread/.test(badge ?? ''), `the badge counts every unread alert (${badge})`);

  await page.click('button[aria-label^="Notifications"]');
  await sleep(500);
  const panel = await bodyText(page);
  check(/Target missed/.test(panel), 'the panel names a breach in words, not by its event key');
  check(/Target recovered/.test(panel), 'a recovery is news too, not only a breach');
  check(/Regression/.test(panel), 'and so is a regression');
  check(/alerts\.probe\.test/.test(panel), 'each row names the page it is about');
  check(/LCP 4\.6 s/.test(panel), 'and carries the line that was actually sent');
  await page.screenshot({ path: `${OUT}/bell-open.png` });

  // The panel is portalled out of the sidebar to escape its clipping; the price is that a
  // click inside it is not a click inside the bell, and the click-away has to know that.
  const panelBox = await page.$eval('[role="dialog"][aria-label="Notifications"]', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, left: r.x, right: r.right, width: r.width };
  });
  check(panelBox.left >= 0 && panelBox.right <= 1440, `it is fully on screen (${Math.round(panelBox.left)}–${Math.round(panelBox.right)}px)`);
  check(panelBox.width >= 300, `at a readable width (${Math.round(panelBox.width)}px)`);
  await page.mouse.click(panelBox.x, panelBox.y);
  await sleep(300);
  check(await page.$('[role="dialog"][aria-label="Notifications"]') !== null, 'clicking inside it does not close it');
  await page.mouse.click(900, 300);
  await sleep(300);
  check(await page.$('[role="dialog"][aria-label="Notifications"]') === null, 'clicking outside does');
  await page.click('button[aria-label^="Notifications"]');
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(300);
  check(await page.$('[role="dialog"][aria-label="Notifications"]') === null, 'and so does Escape');

  await sleep(900);
  const afterOpen = await page.$eval('button[aria-label^="Notifications"]', (el) => el.getAttribute('aria-label'));
  check(afterOpen === 'Notifications', `opening it clears the badge (${afterOpen})`);

  // Unread is a timestamp on the account, so it has to survive the tab going away.
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1800);
  const afterReload = await page.$eval('button[aria-label^="Notifications"]', (el) => el.getAttribute('aria-label'));
  check(afterReload === 'Notifications', `and it stays cleared after a reload (${afterReload})`);

  // ─── Both themes ───────────────────────────────────────────────────────────
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      localStorage.setItem('perfscope-theme', t);
      if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }, theme);
    await sleep(300);
    await page.click('button[aria-label^="Notifications"]');
    await page.evaluate(async () => {
      const mod = await import('/src/shared/ui/toast/index.ts');
      mod.toast.success('Share link copied', { description: 'Anyone with the link can read this report.' });
      mod.toast.error('Could not add that site', { description: 'That URL is already tracked.' });
    });
    await sleep(700);
    await page.screenshot({ path: `${OUT}/${theme}-notifications.png` });
    await page.evaluate(async () => {
      const mod = await import('/src/shared/ui/toast/index.ts');
      mod.toast.clear();
    });
    await page.keyboard.press('Escape');
    await sleep(300);
  }
  console.log(`  screenshots → ${OUT}`);

  const real = errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e.text));
  check(real.length === 0, `no console errors (${real.map((e) => e.text).join(' | ') || 'none'})`);
} finally {
  await browser.close();
  const cleanup = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await cleanup.connect();
  await cleanup.db().collection('alertlogs').deleteMany({ userId: new ObjectId(userId) });
  await cleanup.close();
  await cleanupUser(email);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
