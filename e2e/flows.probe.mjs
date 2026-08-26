/**
 * A user flow, from the editor to the report.
 *
 * The service-level probe (`apps/backend/probes/flow.probe.mts`) proves the measurement;
 * this proves the product around it — that a flow can be written in the UI, run from it,
 * and that the report tells the truth about what each mode measured. The last part is the
 * one worth a browser: Lighthouse hands a snapshot a `performance: 0` it did not earn, and
 * a page that prints it is a page claiming a score nobody measured.
 *
 * Serves its own fixture: a button whose handler blocks for 300ms. A cold audit of that
 * page is fast and clean, which is exactly the blind spot flows exist for.
 *
 *   node e2e/flows.probe.mjs [outDir]
 */
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import {
  WEB_URL, BACKEND_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers,
  sleep, bodyText,
} from './helpers.mjs';

const OUT = process.argv[2] ?? '/tmp/perfscope-flows';
mkdirSync(OUT, { recursive: true });

const PORT = 3407;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Flow fixture</title>
<style>body{font:16px system-ui;margin:2rem}#panel{display:none;height:200px;background:#eee}</style></head>
<body><h1>Flow fixture</h1><button id="open">Open panel</button><div id="panel">Panel</div>
<script>document.getElementById('open').addEventListener('click',()=>{
  const until=performance.now()+300; while(performance.now()<until){}
  document.getElementById('panel').style.display='block';});</script></body></html>`;

const fixture = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
});
await new Promise((r) => fixture.listen(PORT, r));

let failures = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};

/** Click the first element matching `selector` whose text matches, with a real pointer. */
async function clickText(page, selector, text) {
  const box = await page.evaluate((sel, pattern) => {
    const re = new RegExp(pattern);
    // Trimmed: a button with an icon has whitespace around its label, so an anchored
    // pattern like /^Run$/ never matches the raw textContent.
    const el = [...document.querySelectorAll(sel)].find(e => re.test((e.textContent ?? '').trim()));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  }, selector, text.source);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

await waitForServers();
const { token, refreshToken, user, email } = await registerUser();

const api = (path, init = {}) => fetch(`${BACKEND_URL}/api${path}`, {
  ...init,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
});

// ─── The definition is validated, not repaired ───────────────────────────────
const noSelector = await api('/flows', {
  method: 'POST',
  body: JSON.stringify({ name: 'Bad', url: `http://localhost:${PORT}/`, steps: [{ action: 'click' }] }),
});
check(noSelector.status === 400, `a click with no selector is refused (${noSelector.status})`);
check(/needs a CSS selector/.test((await noSelector.json()).error ?? ''), 'saying what is missing, and in which step');

const noSteps = await api('/flows', {
  method: 'POST',
  body: JSON.stringify({ name: 'Empty', url: `http://localhost:${PORT}/`, steps: [] }),
});
check(noSteps.status === 400, 'a flow with no steps is refused — that is an audit, not a flow');

const created = await api('/flows', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Fixture — open the panel',
    url: `http://localhost:${PORT}/`,
    formFactor: 'desktop',
    snapshotAtEnd: true,
    steps: [
      { action: 'click', selector: '#open', name: 'Open the panel' },
      { action: 'waitFor', selector: '#panel', measure: false },
    ],
  }),
});
check(created.status === 201, `a valid flow is stored (${created.status})`);
const flow = (await created.json()).data;

const { browser, page, errors } = await launchAuthedBrowser({ user, token, refreshToken });

try {
  await page.goto(`${WEB_URL}/flows`, { waitUntil: 'networkidle0' });
  await sleep(2000);

  const listed = await bodyText(page);
  check(/Fixture — open the panel/.test(listed), 'the flow is listed');
  check(/Open the panel/.test(listed), 'described by its measured step, not by its plumbing');
  check(/never run/i.test(listed), 'and says it has never run');
  await page.screenshot({ path: `${OUT}/flows-list.png` });

  // ─── Run it, through the button a person presses ───────────────────────────
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(b => /^Run$/.test(b.textContent?.trim() ?? ''));
    if (!button) return null;
    const r = button.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check(!!clicked, 'the list offers a Run button');
  await page.mouse.click(clicked.x, clicked.y);

  await sleep(1500);
  check(/Running/i.test(await bodyText(page)), 'which reports progress while it runs');

  // A flow is three Lighthouse gathers; three minutes is generous and bounded. The wait is
  // on the report's own marker — text can match something else on the page.
  await page.waitForSelector('[data-flow-mode="timespan"]', { timeout: 180_000 }).catch(() => {});
  const report = await bodyText(page);

  check(/Page load/.test(report), 'the report shows the cold load');
  check(/Interaction/.test(report), 'the interaction it was written for');
  check(/Final state/.test(report), 'and the state it left behind');

  // ─── The number no cold audit of this page can produce ─────────────────────
  const inp = report.match(/INP\s*\n?\s*([\d.]+)\s*(ms|s)/);
  console.log(`  INP on screen: ${inp?.[1] ?? '—'}${inp?.[2] ?? ''}`);
  check(!!inp, 'INP is on screen at all');
  const inpMs = inp ? Number(inp[1]) * (inp[2] === 's' ? 1000 : 1) : 0;
  check(inpMs > 200, `and it is the 300ms the handler blocks for (${Math.round(inpMs)}ms)`);

  // ─── Each mode shows only what it measured ─────────────────────────────────
  // The trap: a snapshot's performance score is 0 because it has no timing, and printing
  // it would tell the reader the page scored zero.
  // Read the card by its mode, not by hunting for prose: each step card carries
  // `data-flow-mode`, so this asserts about the snapshot card and nothing else.
  const modes = await page.evaluate(() =>
    document.querySelector('[data-flow-mode="snapshot"]')?.textContent ?? '');
  check(!/Performance\s*0\b/.test(modes), 'the final-state card does not print a performance score of 0');
  check(/Accessibility/.test(modes), 'but does show the accessibility it actually measured');
  await page.screenshot({ path: `${OUT}/flow-report.png`, fullPage: false });

  // ─── It was stored, and the list knows ─────────────────────────────────────
  const runs = await api(`/flows/${flow.id}/runs`).then(r => r.json());
  check(runs.data.length === 1, 'the run was stored against the flow');
  check(runs.data[0].steps.length === 3, 'with all three measured steps');

  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2000);
  check(/ran (just now|\d+)/i.test(await bodyText(page)), 'and the list now says when it last ran');

  // ─── Writing one in the editor ─────────────────────────────────────────────
  // The API path is covered above; this is the surface a person actually uses, and the
  // step rows are the part with real logic in them.
  await clickText(page, 'button', /New flow/);
  await sleep(700);
  check(/New flow/.test(await bodyText(page)), 'the editor opens');

  await page.evaluate((url) => {
    const set = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
    set(inputs[0], 'Written in the editor');
    set(inputs[1], url);
    // The third input is the first step's selector — the row renders it because the
    // default action is "click", which is the point of the default.
    if (inputs[2]) set(inputs[2], '#open');
  }, `http://localhost:${PORT}/`);
  await sleep(400);

  const savedIt = await clickText(page, 'button', /Create flow/);
  check(savedIt, 'and offers to create the flow');
  await sleep(1800);

  const afterSave = await bodyText(page);
  check(/Written in the editor/.test(afterSave), 'which then appears in the list');
  // Asserted on the modal's own control rather than on page text: "New flow" is also the
  // page's button, and matching prose would pass whether or not the dialog was still up.
  const editorStillOpen = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some(b => /Create flow/.test(b.textContent ?? '')));
  check(!editorStillOpen, 'and the editor closed');

  // A step with no selector is refused by the server, and the editor shows what it said
  // rather than a generic failure.
  await clickText(page, 'button', /New flow/);
  await sleep(700);
  await page.evaluate((url) => {
    const set = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
    set(inputs[0], 'Missing a selector');
    set(inputs[1], url);
  }, `http://localhost:${PORT}/`);
  await sleep(300);
  await clickText(page, 'button', /Create flow/);
  await sleep(1500);
  check(/needs a CSS selector/.test(await bodyText(page)),
    'the server\'s own message is shown, naming what is missing');
  await page.screenshot({ path: `${OUT}/flow-editor.png` });
  await clickText(page, 'button', /Cancel/);
  await sleep(500);

  // ─── The schedule and the targets ──────────────────────────────────────────
  // A flow that only runs when somebody presses a button measures the day they pressed it.
  const scheduled = await api(`/flows/${flow.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Fixture — open the panel',
      url: `http://localhost:${PORT}/`,
      steps: [
        { action: 'click', selector: '#open', name: 'Open the panel' },
        { action: 'waitFor', selector: '#panel', measure: false },
      ],
      schedule: { enabled: true, time: '04:30' },
      // Below what the fixture's 300ms handler can possibly achieve, so the run misses it.
      targets: { inp: 100, tbt: null, cls: null },
    }),
  });
  check(scheduled.status === 200, `a flow can be given a schedule and targets (${scheduled.status})`);
  const savedFlow = (await scheduled.json()).data;
  check(savedFlow.schedule?.enabled === true && savedFlow.schedule?.time === '04:30',
    'which come back on the definition');
  check(savedFlow.targets?.inp === 100, 'targets too');

  const badTime = await api(`/flows/${flow.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'x', url: `http://localhost:${PORT}/`,
      steps: [{ action: 'click', selector: '#open' }],
      schedule: { enabled: true, time: '25:99' },
    }),
  });
  check(badTime.status === 400, 'a malformed time is refused rather than quietly repaired');

  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2000);
  const withSchedule = await bodyText(page);
  check(/daily 04:30/.test(withSchedule), 'the card says when it runs');

  // Run it again, now that it has a target it cannot meet.
  const started = await clickText(page, 'button', /^Run$/);
  check(started, 'the card offers Run after a reload');
  await sleep(1500);
  const running = /Running/i.test(await bodyText(page));
  check(running, 'and the second run starts');

  // Waited on the report's own marker rather than on page text. The first version watched
  // for "INP" and moved on early, which reloaded the page mid-run: the run then finished
  // and stored itself *after* the probe had already counted, and after cleanup had run —
  // which is also how four orphan rows were left in Mongo.
  await page.waitForSelector('[data-flow-mode="timespan"]', { timeout: 180_000 }).catch(() => {});

  let runsAfter = { data: [] };
  for (let i = 0; i < 30; i++) {
    runsAfter = await api(`/flows/${flow.id}/runs`).then(r => r.json());
    if (runsAfter.data.length >= 2) break;
    await sleep(1000);
  }
  check(runsAfter.data.length === 2, `the second run is stored too (${runsAfter.data.length})`);

  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2200);
  const verdict = await bodyText(page);
  check(/1 target missed/.test(verdict), 'and the card leads with the target it missed');

  // The trend only means something with more than one run behind it.
  await clickText(page, 'button', /History/);
  await sleep(1500);
  check(/slowest interaction per run/.test(await bodyText(page)),
    'the history panel plots the slowest interaction per run');
  await page.screenshot({ path: `${OUT}/flow-targets.png` });

  const noisy = errors.filter(e => !/favicon|status of 401|status of 400/i.test(e.text));
  check(noisy.length === 0, `no console errors (${noisy.length})`);
  if (noisy.length) console.log(noisy.slice(0, 4));
  console.log(`  screenshots → ${OUT}`);
} finally {
  await browser.close();
  await cleanupUser(email);
  fixture.close();
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
