/**
 * Probe: does the compare page show Gemini's verdict on the matchup?
 *
 * Runs a real side-by-side comparison in the browser and watches the card under the
 * scoreboard go from skeleton to sentence. The verdict is generated server-side when the
 * comparison is saved, so this also proves the page reads it back out of that response
 * rather than asking for it separately.
 *
 * Needs backend (3101) and web (5173) running:
 *
 *     node e2e/compare-verdict.probe.mjs
 */
import { WEB_URL, registerUser, cleanupUser, launchAuthedBrowser, waitForServers, sleep } from './helpers.mjs';

const LEFT  = process.argv[2] ?? 'https://example.com';
const RIGHT = process.argv[3] ?? 'https://example.org';

await waitForServers();
const { token, user, email } = await registerUser();
const { browser, page, errors } = await launchAuthedBrowser({ user, token });

page.on('response', async (res) => {
  if (!res.url().includes('/compare-history')) return;
  let body = '';
  try { body = (await res.text()).slice(0, 300); } catch { /* body already consumed */ }
  console.log(`  [net] ${res.request().method()} ${res.status()} ${body}`);
});

try {
  await page.goto(`${WEB_URL}/compare`, { waitUntil: 'networkidle0' });
  await sleep(2500);

  const inputs = await page.$$('input[type="text"]');
  if (inputs.length < 2) throw new Error(`expected two URL inputs, found ${inputs.length}`);

  // The fields are pre-filled with "https://" — clear before typing.
  for (const [input, url] of [[inputs[0], LEFT], [inputs[1], RIGHT]]) {
    await input.click({ clickCount: 3 });
    await input.type(url);
  }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /compare|launch|run/i.test(b.textContent ?? ''));
    btn?.click();
  });
  console.log(`comparing ${LEFT} vs ${RIGHT} …`);

  let sawSkeleton = false;
  let verdict = null;
  for (let i = 0; i < 240; i++) {
    const snap = await page.evaluate(() => {
      // Anchor on the heading and walk out two levels: h3 sits in the card's header row,
      // and the card's last child is the commentary. Searching for a div that *contains*
      // the heading matches every ancestor as well as the header itself.
      const h3 = [...document.querySelectorAll('h3')].find((h) => h.textContent === 'The verdict');
      const card = h3?.parentElement?.parentElement;
      if (!card) return { present: false };
      return {
        present:  true,
        pending:  card.querySelectorAll('.animate-pulse').length > 0,
        text:     card.lastElementChild?.textContent?.trim() ?? '',
      };
    });
    if (snap.present && snap.pending && !sawSkeleton) {
      sawSkeleton = true;
      console.log('  verdict card up, still writing…');
    }
    if (snap.present && !snap.pending && snap.text) { verdict = snap.text; break; }
    await sleep(500);
  }

  console.log(`\n  skeleton phase : ${sawSkeleton ? 'seen' : 'not seen'}`);
  console.log(`  verdict        : ${verdict ?? '(never rendered)'}`);
  console.log(`  console errors : ${errors.length ? errors.map((e) => e.text).slice(0, 3).join(' | ') : 'none'}`);

  const dump = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('h3')].map((h) => ({
      title: h.textContent,
      sibling: h.parentElement?.parentElement?.lastElementChild?.textContent?.trim().slice(0, 100),
    }));
    const idx = document.body.innerText.indexOf('The verdict');
    return { cards, around: idx >= 0 ? document.body.innerText.slice(idx, idx + 260) : '(not in page text)' };
  });
  console.log('\n  h3 cards on page:', JSON.stringify(dump.cards));
  console.log('  text around "The verdict":\n', dump.around);
} finally {
  await browser.close();
  await cleanupUser(email);
}
