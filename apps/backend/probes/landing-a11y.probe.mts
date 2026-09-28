/**
 * The signed-out pages, measured the way the signed-in routes are.
 *
 * `app-a11y.probe.mts` seeds an account and walks the dashboard; the landing page has no
 * account and never appeared in that sweep, so its score was whatever it happened to be.
 * This snapshots `/` in both themes and both widths and prints every failing audit.
 *
 *   npx tsx probes/landing-a11y.probe.mts            # every signed-out route, both themes, both widths
 *   npx tsx probes/landing-a11y.probe.mts /login     # one route
 */
import puppeteer from 'puppeteer';
import { startFlow } from 'lighthouse';
import { CHROME_ARGS } from '../src/lib/chrome.js';

const WEB_URL = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';
/** Every page a person can reach without an account. None is in the signed-in sweep. */
const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/', '/login', '/register', '/forgot-password', '/reset-password?token=probe'];

const browser = await puppeteer.launch({ headless: true, args: CHROME_ARGS });
let worst = 1;
try {
  for (const route of ROUTES) for (const theme of ['dark', 'light'] as const) {
    for (const mobile of [false, true]) {
      const page = await browser.newPage();
      await page.setViewport(mobile
        ? { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true }
        : { width: 1350, height: 940, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument((t) => {
        try { localStorage.setItem('perfscope-theme', t); } catch { /* opaque origin */ }
      }, theme);
      await page.goto(`${WEB_URL}${route}`, { waitUntil: 'networkidle2' });
      // Scroll once through the page so every `.reveal` block has entered; a section still
      // at opacity 0 is measured as invisible text rather than as the text it is.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await new Promise(r => setTimeout(r, 1200));

      const flow = await startFlow(page, { name: `${route} ${theme}`, flags: { screenEmulation: { disabled: true } } });
      await flow.snapshot({ name: 'landing' });
      const lhr = (await flow.createFlowResult()).steps[0]!.lhr;
      const score = lhr.categories['accessibility']?.score ?? null;
      worst = Math.min(worst, score ?? 0);
      const failures = Object.entries(lhr.audits)
        .filter(([id, a]) => a.score !== null && (a.score ?? 1) < 1
          && (lhr.categories['accessibility']?.auditRefs ?? []).some(r => r.id === id));
      console.log(`${route.padEnd(24)} ${theme.padEnd(5)} ${mobile ? 'mobile ' : 'desktop'} accessibility ${score === null ? '—' : Math.round(score * 100)}`);
      for (const [id, a] of failures) {
        const items = ((a.details as { items?: { node?: { selector?: string } }[] } | undefined)?.items) ?? [];
        console.log(`  ✗ ${id} — ${a.title}`);
        for (const it of items.slice(0, 14)) console.log(`      ${it.node?.selector ?? ''}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(worst >= 1 ? 0 : 1);
