# Analyzer sprint — "what changed, where exactly, and how big is the JS"

Written 2026-08-22 for a session that may start with no memory of the one that produced it.
Read `CLAUDE.md` first, then this file top to bottom. Four features, agreed with the user in
this order of mention: (1) delta vs. the previous run, (2) JS bundle treemap, (3) element
screenshots on failing audits, (4) audit-list search + category filter (+ a11y grouping).
Recommended *execution* order is A → B → C → D below — C plugs into UI that B builds, and D is
independent. Each phase ends with a gate and a live check before the next starts.

Standing rules from the user, verbatim: `"men demeden commit ve push etme hec vaxt"` — never
commit or push unless told in that turn (two separate gates). No `Co-Authored-By` trailer in
commit messages. Prose to the user in Azerbaijani; code, comments, commit messages English.

---

## 0. What exists today (verified 2026-08-22 against the tree at `420c891`)

- `packages/shared/src/types/analysis.ts` — `AnalysisResult` (scores, metrics, audits,
  resources, timelineData, flameChartData, clsData, thirdParty, measurement, ai*),
  `AuditItem { id, title, description, score, displayValue, impact, aiExplanation?,
  details?: AuditDetail[], savingsMs?, savingsBytes? }`, `AuditDetail { selector?, snippet?,
  url?, value? }`. **No category on an audit, no previous-run info, no bundle data.**
- `apps/backend/src/services/lhr-transform.ts` — `extractFailingAudits(lhr.audits)` keeps
  score < 0.9, sorted, **top 15 per LHR**, dedup by id across the two LHRs (static
  seo/bp/a11y LHR + performance LHR). `extractAuditDetails` keeps the first 5
  `details.items` (selector / snippet / url / value), tail-truncated where the identifying
  part is at the end. `buildFullResult` runs every parser off the performance LHR.
- `apps/backend/src/services/lighthouse.worker.ts` — self-contained (no relative VALUE
  imports — tsx's `.js→.ts` remap does not work in worker threads). Launches puppeteer
  Chrome, runs `lighthouse(url, { onlyCategories, throttlingMethod,
  disableFullPageScreenshot: true, skipAboutBlank: true })`, posts the whole `lhr` plus the
  compact trace/network extracts. Static group = `['seo','best-practices','accessibility']`
  with `simulate`; timed group = performance with `provided`.
- `apps/backend/src/services/previousRun.service.ts` — `getPreviousRun(userId, url,
  before)` → `{ analysisId, scores, metrics, at, resources: ResourceSnapshot }`, indexed
  query, `.lean()`, projection only. `apps/backend/src/lib/resourceDiff.ts` —
  `diffResources(current, previous): ResourceDiff { added, removed, grown, shrunk,
  librariesAdded/Removed, vendorsAdded/Removed }` with 5 KB / 15 % growth floors and
  `formatResourceDiff` (lines for the AI prompt and alerts).
- `apps/backend/src/services/auditPipeline.ts` — `enrichWithAi(result, {depth, userId})`
  fetches `getPreviousRun` itself (only for `deep`) and hands it to `analysePage`.
  `persistAudit` stores `result` whole as `History.fullResult` → a reopened audit and the
  public report render exactly what the live client saw. **Anything written onto `result`
  before `persistAudit` survives for free.**
- `apps/backend/src/socket/analysis.handler.ts` `runAudit()` — `measure()` → emit
  `analysis:complete` → `resolveProjectId` → `enrichWithAi` → emit `analysis:insights`
  (always) → `persistAudit`. Nightly (`nightlyAudit.service.ts:47`) and REST
  (`analyzer.routes.ts:44`) call `enrichWithAi` + `persistAudit` directly.
- Frontend: `widgets/analyzer-results/AnalyzerResultsPanel.tsx` composes `ScoreCard ×4`,
  `MetricsGrid`, `TimelineWaterfall`/`ResourceWaterfall`, `ResourcesAlert`,
  `ResourceBreakdown`, `ResourceDependencyChain`, `HeapMemoryChart`, `InteractionTimeline`,
  `CLSVisualizer`, `CruxFieldPanel`, `ThirdPartyPanel`, `AuditList`. Used by
  `pages/analyzer/AnalyzerPage.tsx` **and** `pages/report/PublicReportPage.tsx` — every
  addition must render sensibly for a stored/public result too.
- `entities/analysis/ui/AuditList.tsx` — severity `Segmented` (All/Critical/High/Other),
  `IssueRow` expands to description + `AiNote`. **`AuditItem.details` is not rendered
  anywhere** — selectors and snippets only ever reached the AI prompt.
- `entities/analysis/ui/ScoreCard.tsx` `({ label, score })`, `MetricsGrid.tsx`
  `({ metrics, notes, aiPending })` — no previous values.
- Shared thresholds already exist and must be reused, never redefined:
  `packages/shared/src/lib/regression.ts` (`SCORE_NOISE_POINTS = 10`, `METRIC_NOISE` for
  lcp/tbt/cls, `REGRESSION_PCT = 15`, `scoreVerdict`, `isRegression`),
  `packages/shared/src/lib/targets.ts` (`TARGET_DIRECTION` floor/ceiling),
  `measurement.ts` (`NOISY_SPREAD`).
- Lighthouse 12 facts (checked in `node_modules/lighthouse`): `script-treemap-data` is an
  auditRef of the **performance** category (`group: 'hidden'`, weight 0) → it already runs
  in our performance LHR and is simply dropped. Its `details.nodes: LH.Treemap.Node[]`
  (`name, resourceBytes, encodedBytes?, unusedBytes?, duplicatedNormalizedModuleName?,
  children?`). `lhr.fullPageScreenshot = { screenshot: { data (webp data URL), width,
  height }, nodes: Record<lhId, Rect> }` when `disableFullPageScreenshot` is false;
  `details.items[].node.lhId` + `boundingRect` link an item to that map.
  `lhr.categories[c].auditRefs[].{id, group}` + `lhr.categoryGroups[group].title` give
  category membership and the a11y/perf group titles ("Contrast", "Names and labels", …).
- Verification assets: backend has no test runner — `apps/backend/probes/*.probe.mts` are
  run by hand (`npx tsx probes/x.probe.mts` from `apps/backend`, backend on 3101 when the
  probe needs it); `e2e/*.probe.mjs` drive the dashboard with puppeteer (`e2e/helpers.mjs`:
  `launchAuthedBrowser`, `waitForBackend`, `cleanupUser`); unit tests are vitest in
  `packages/shared` and `apps/web-dashboard` (`pnpm test`). Gates: `pnpm build`,
  `tsc --noEmit -p apps/web-dashboard/tsconfig.app.json` (the bare `tsc --noEmit` checks
  nothing there), `pnpm --filter @perfscope/web-dashboard lint` (0 errors), `pnpm test`,
  `pnpm e2e` (servers running).

---

## Principles

1. **Derive, never duplicate.** Direction of "better" comes from `TARGET_DIRECTION`; "is
   this change real or noise" from `regression.ts`. The UI reads the stored result — no
   client-side refetch of the previous run.
2. **Write onto `result`, before `persistAudit`.** That is the one mechanism that makes a
   feature appear identically in the live view, a reopened history row, the public report
   and the CLI. Every phase follows it.
3. **Measure storage.** `fullResult` already carries trace-derived data; each phase logs
   `JSON.stringify(fullResult).length` before/after on the same page (use
   `probes/capture-fixtures.probe.mts --from-db` or a live run). Budget: A+B+D together
   ≤ +20 % on bbc.com; C (screenshots) ≤ 150 KB per audit, enforced by caps in code.
4. **Old stored results have none of the new fields.** Every UI addition renders nothing
   (not a broken control) when the field is absent — same rule as `AiCard`.
5. **The worker stays self-contained** — any helper it needs is inlined there.
6. **Gate, then live-check, then stop for the user's word before committing.**

---

## Phase A — Delta vs. the previous run (~1 day)

**Why:** the AI diagnosis opens with "what moved", but the numbers it talks about show no
movement. A person comparing two runs today opens History and reads two rows. The data
(`getPreviousRun`, `diffResources`) already exists server-side.

### A1. Shared type
`packages/shared/src/types/analysis.ts`:
```ts
export interface PreviousRunSummary {
  analysisId: string
  /** ISO timestamp of the run compared against. */
  at:         string
  scores:     PerformanceScores
  metrics:    CoreWebVitals
  /** Resource-level movement; absent when nothing crossed the noise floors. */
  resourceDiff?: ResourceDiff
  /** Audit ids failing now that did not fail then. */
  newAuditIds: string[]
  /** Audits failing then that pass (or vanished) now. */
  fixedAudits: { id: string; title: string }[]
}
// on AnalysisResult:
previous?: PreviousRunSummary
```
Move the **types** `DiffableResource/DiffableLibrary/DiffableVendor/ResourceSnapshot/
ResourceDiff` from `apps/backend/src/lib/resourceDiff.ts` into
`packages/shared/src/types/resourceDiff.ts` (backend file re-exports them; the functions
stay in backend). The frontend needs the shape, not the algorithm.

### A2. Backend — one attach point
- `previousRun.service.ts`: extend the projection with `fullResult.audits.id
  fullResult.audits.title fullResult.audits.score` and `fullResult.formFactor`; return
  `audits: { id, title }[]` on `PreviousRun`. **Match the form factor**: a desktop run is
  not the previous of a mobile run. Filter with
  `{ 'fullResult.formFactor': { $in: [ff, null] } }` where rows saved before the toggle
  existed (no field) count as mobile — check `lighthouse.service.ts`'s default before
  hard-coding that.
- `auditPipeline.ts`: new `attachPreviousRun(result, userId): Promise<PreviousRun | null>`
  — calls `getPreviousRun(userId, result.url, new Date(result.timestamp))`, builds the
  current `ResourceSnapshot` the same way `enrichWithAi` already does (reuse that helper,
  do not copy it), computes `diffResources`, sets `result.previous` (omit `resourceDiff`
  when `!resourceDiffHasChanges`), returns the full `PreviousRun` so the caller can hand it
  to the AI. `enrichWithAi` gains `opts.previous?: PreviousRun | null` and only queries
  when the option is `undefined` — one DB round trip per audit, not two.
- Call sites: `runAudit()` — `await attachPreviousRun(result, userId)` **before**
  `socket.emit('analysis:complete')` (it is one indexed query, a few ms; the deltas must
  arrive with the scores, not with the AI); nightly and REST — before `enrichWithAi`.
  Unauthenticated REST (`userId` undefined) skips it.
- `regression.service.ts` and `alerts` keep using their own lookup — out of scope.

### A3. Frontend
- `entities/analysis/lib.ts`: `deltaOf(kind, curr, prev)` → `{ diff, direction:
  'better' | 'worse' | 'same', meaningful }`. Scores: `scoreVerdict` (10-point floor).
  lcp/tbt/cls: `isRegression`-style thresholds from `METRIC_NOISE` + `REGRESSION_PCT`
  both ways. fcp/si/tti: `REGRESSION_PCT` relative only (no absolute table exists; say so
  in a comment). Unit-test it in `entities/analysis/lib.test.ts`.
- `entities/analysis/ui/DeltaBadge.tsx` — `▲ +4` / `▼ −120 ms`, `BAND_*` emerald/rose
  tokens when `meaningful`, `text-ld-text-3` muted when inside noise, `title` tooltip
  "vs run from {date}". Export from the entity barrel.
- `ScoreCard` gains `previous?: number`; `MetricsGrid` gains `previous?: CoreWebVitals`
  (badge beside the value, formatted with the tile's own `fmt`).
- `AnalyzerResultsPanel`: a one-line caption under the score row — "Compared with the run
  from 14 Aug 2026 · 3 new requests, 1 removed" — only when `data.previous` exists.
- Resources: a `SinceLastRun` strip (new file in `features/analyzer/ui`, placed above
  `ResourcesAlert` in both waterfall branches) listing added / removed / grown / shrunk
  with sizes, collapsed to counts by default. `WaterfallRow` gets `change?: 'added' |
  'grown'` → a small tag at the row end; `TimelineWaterfall` and `ResourceWaterfall` build
  a `Map<url, change>` from `data.previous.resourceDiff` once (`useMemo`) and pass it down.
- `AuditList`: "New" pill on ids in `newAuditIds`; a collapsed footer row "Fixed since
  last run (n)" listing `fixedAudits` titles. Both render nothing without `previous`.
- CLI (`packages/cli`): optional one line "Δ vs previous: perf +4, LCP −120 ms" in the
  report printer if the field is present — 10 lines, do it last.

### A4. Verification
- `apps/backend/probes/previous-run.probe.mts`: seeds two History rows for a throwaway
  user (second with one extra request, one audit removed, perf +12), runs
  `attachPreviousRun`, asserts `scores/metrics/newAuditIds/fixedAudits/resourceDiff`, and
  asserts a desktop row is **not** picked as the previous of a mobile run. Cleans up.
- `e2e/previous-run.probe.mjs`: audit the same URL twice through the socket, open the
  analyzer, assert `DeltaBadge` count ≥ 4 and the caption text; screenshot both themes.
- Reopen the second audit from History and the public share link — deltas still there.
- Gates green. Stop; report; wait for the commit word.


### A5. DONE — 2026-08-22

**Shipped exactly as designed above**, with these decisions worth keeping:

- `PreviousRunSummary.at` is a full ISO timestamp, not the date-only string `PreviousRun.at`
  already carried (a prompt reads a day, a UI formats an instant) — `PreviousRun` gained
  `atIso` beside it rather than changing the field the AI prompts already read.
- `snapshotOf(result)` in `lib/resourceDiff.ts` replaced the *three* inline copies of the
  current-run snapshot literal (pageContext, regression.service, and the new attach point).
  They must agree: a diff counting third parties in one place and not another would have the
  alert and the page describing different changes.
- **A real bug fixed on the way**: `getPreviousRun` never matched on form factor, so a
  mobile audit was compared against yesterday's desktop one — every score "regressed" and
  every resource looked resized, purely from the emulation. All four callers now pass
  `result.formFactor` (analyzer deltas, AI page analysis, regression alerts, ask-a-question).
  A stored run with **no** `formFactor` counts as desktop, because that is the default
  `lighthouse.service.ts` gives a run without one (`full.formFactor = formFactor ?? 'desktop'`) —
  not a guess.
- One DB round trip per audit, not two: `attachPreviousRun` returns the full `PreviousRun`
  and `enrichWithAi` takes it as `opts.previous` (`undefined` = not looked up, `null` = looked
  up and there is none).
- Attached on **all three** entry paths — socket (before `analysis:complete`, so the arrows
  arrive with the numbers they annotate), nightly cron (the audit nobody watched is exactly
  where "what moved overnight" has to be readable), and the REST path (no-op when anonymous).
- `fixedAudits` is worded "no longer reported since last run", not "fixed": an audit can also
  drop out of the capped list because something worse pushed it out. Capped at 8.
- No `resourceDiff` at all when nothing crossed the noise floors — "the page is the same as
  last time" is a claim worth making, and an empty panel says it far less clearly.

**Verified**
- `probes/previous-run.probe.mts` — **25/25 PASS**. Covers the summary's contents, new/fixed
  audit sets, the three diff buckets, the unchanged page, both form-factor directions plus
  the legacy no-field row, the first-ever audit, the anonymous audit, and that the whole
  comparison survives `persistAudit` into Mongo (which is what makes history reopen, the
  public report and the CLI agree with the live view).
- `e2e/previous-run.probe.mjs` — **10/10 PASS** against a live audit of example.com with a
  seeded predecessor: 10 delta badges (4 scores + 6 vitals), 9 of them coloured rather than
  muted, the caption, the expanded "Since last run" strip naming `legacy-bundle.js`, the
  "no longer reported" list naming the seeded audit, `new` tags on waterfall rows, zero
  console errors, screenshots in both themes. Live AI output picked up the same diff
  unprompted: *"removing /hero-uncompressed.png, /legacy-bundle.js, and jQuery successfully
  eliminated your previous bottlenecks."*
- `deltaOf` unit-tested (7 cases) in `entities/analysis/lib.test.ts`; the CLI reporter
  exercised with and without `previous` — output is byte-identical to before when absent.
- Gates: `pnpm build`, `pnpm typecheck` (6 workspaces), `pnpm test` (99), lint **0 errors**
  (30 warnings, the pre-existing baseline), `pnpm e2e` **21/21**.

**Note on the commit**: this work was swept into commit `6f1dfe0`, whose message describes
unrelated AI work, by a parallel session committing the shared working tree. Nothing was
lost; the history is simply mislabelled for this change.

---

## Phase B — Audit list: category, search, a11y groups, and the details themselves (~1 day)

**Why:** with performance + a11y + SEO + BP mixed in one severity-sorted list of 15–60
rows, finding "the contrast issues" means reading everything. And the best evidence the
backend collects — selectors, snippets, URLs — is never shown to the person.

### B1. Shared type
`AuditItem` gains `category: AnalysisCategory` and `group?: string` (Lighthouse's
`categoryGroups[...].title`, e.g. "Contrast", "Names and labels", "Diagnostics"). Optional
on the wire for old rows: declare as `category?: AnalysisCategory` — the frontend hides the
category control when any audit lacks it.

### B2. Backend
- `lhr-transform.ts`: build `refIndex: Map<auditId, { category, group? }>` from
  `lhr.categories[*].auditRefs` + `lhr.categoryGroups`; `extractFailingAudits(audits,
  refIndex)` stamps both. Cap becomes **15 per category** (the static LHR currently
  contributes 15 total across three categories, so a11y alone was often cut to 5–6 rows).
  **Trap:** `services/ai/pageContext.ts` reads `result.audits` to build the prompt — it
  already caps at fourteen ("Failing audits explained per run…"). Confirm the cap is
  applied there and not implied by the transform, or the prompt grows 4×.
- Probe: `probes/audit-categories.probe.mts` — live audit of `https://example.com`
  (cheap) asserts every `result.audits[i].category` is set and a11y rows carry `group`.

### B3. Frontend (`entities/analysis/ui/AuditList.tsx` + new pieces)
- Header becomes two rows on narrow screens: category `Segmented` (All · Performance ·
  Accessibility · Best practices · SEO, each with a count, hidden when counts are all
  zero or category is absent), severity `Segmented` (kept), and a shared `Input` with the
  search icon (`placeholder="Search audits, selectors, files"`). Pure predicate
  `matchesAuditQuery(audit, q)` in `entities/analysis/lib.ts` — title, description,
  `details[].selector/url/snippet` — unit-tested.
- Accessibility category view groups rows under `group` sub-headers (mono uppercase, same
  style as the "Opportunities & diagnostics" label); other categories stay flat.
- `IssueRow` body renders `details` under the description: a tight list — selector in
  mono with `CopySnippet`, snippet in a scrollable mono block (`overflow-x:auto`, never
  the page), url tail-truncated already, value right-aligned. Empty → nothing. This is the
  slot Phase C fills with thumbnails.
- Empty state per filter combination ("No accessibility issues match 'nav'") and a
  one-click clear.
- `?audit=<id>` deep link: open + scroll on mount (the advisor's `action: {kind:'audit'}`
  can use it later). Small; include.

### B4. Verification
Unit tests for the predicate; `e2e/audit-filters.probe.mjs` (type "contrast", assert the
visible rows, switch category, assert sub-headers, screenshot both themes); lint 0 errors
(FSD: `entities` must not import from `features` — `CopySnippet` and `Input` are
`shared/ui`, fine). Stop; report; wait.


### B5. DONE — 2026-08-22

**Shipped as designed**, plus two things the plan did not anticipate:

- **Placements are read from the LHR, not hard-coded.** `buildAuditPlacements(lhr)` walks
  `categories[*].auditRefs` and resolves each `group` id through `categoryGroups[*].title`,
  so the analyzer shows Lighthouse's own group names ("Contrast", "Names and labels",
  "Internationalization and localization") and gains new ones for free at the next
  Lighthouse release. First category wins for an audit two categories reference.
- **The cap is per category (15), and audits with no placement share one bucket of 15** so
  an unrecognised audit cannot slip past the budget. Verified: the static run used to share
  fifteen rows between seo, best-practices and accessibility, and whichever scored worst
  took nearly all of them.
- **Ordering changed, deliberately.** `buildFullResult` now sorts the merged list worst
  first. It was concatenation order, which put every seo and best-practices finding ahead
  of every performance opportunity however bad — visible to the reader as an odd default
  order, and to the AI as the first fourteen it is handed (`AUDIT_LIMIT` in pageContext,
  which still caps at 14, so the prompt did not grow).
- **`AuditItem.details` is rendered for the first time** (`ui/AuditDetails.tsx`): selector
  and URL with a copy button, snippet in its own scrolling block, value inline. The backend
  has collected this since AI phase 1 and only the model ever saw it. `CopySnippet` gained
  a `size="sm"` variant rather than the codebase gaining a fourth hand-rolled copy button.
- **Unplanned fix, found by looking at the result**: Lighthouse writes its descriptions in
  Markdown and every one ends with `[Learn more](https://…)`. Rendered as plain text — which
  is what the audit list did — that tail is a bare URL in brackets in the middle of a
  sentence, and putting the description in front of people made it obvious.
  `parseAuditDescription` splits it into parts and the row renders real anchors (http(s)
  only, so nothing in a description can produce a `javascript:` URL, and no
  `dangerouslySetInnerHTML`).
- Grouping shows only when it splits the view (`groups.length > 1`); `groupAudits` and
  `matchesAuditQuery` live in `entities/analysis/lib.ts` as pure, unit-tested functions.
  Search covers title, description, displayValue, group **and every detail field** — someone
  arriving from a code review knows the filename or the class, not Lighthouse's wording.
- `?audit=<id>` opens and scrolls to one finding. `useSearchParams` is read in the *widget*
  and passed down, because `entities/**` may not import routing (the FSD rule) and the same
  list renders inside the public report.

**Verified**
- `probes/audit-categories.probe.mts` — **13/13 PASS**. A synthetic LHR proves the
  per-category budgeting (20 failing a11y + 20 failing perf → 15 + 15, not 15 total),
  that a passing audit is still never reported, and that unplaced audits get their own
  bucket. Then a live audit asserts every audit carries a category and a11y audits carry a
  group title. Run against wikipedia.org, bbc.com/news and the W3C "before" demo; all three
  report far fewer accessibility failures than expected, which is Lighthouse's automated
  coverage, not a bug here — `--no-live` skips the run, `PROBE_URL` overrides the target.
- `e2e/audit-filters.probe.mjs` — **24/24 PASS** against `e2e/fixtures/inaccessible.html`,
  served by the probe itself on port 3397. That fixture fails on purpose in five
  accessibility groups plus SEO and best-practices, which is the only way to assert
  grouping and category filtering without depending on someone else's site staying broken.
  Live result: `All 14 | Accessibility 8 | Best practices 3 | SEO 3`, five group headers,
  search narrowing to the contrast finding, the empty state quoting the query, three copy
  buttons on the expanded evidence, the deep link opening its row, both themes, zero
  console errors.
- Unit tests: `matchesAuditQuery` (5), `groupAudits` (4), `parseAuditDescription` (5) —
  33 web-dashboard tests in total.
- Gates: build, typecheck (6 workspaces), test (113), lint **0 errors**, `pnpm e2e` 21/21.

---

## Phase C — Element screenshots on failing audits (~1 day)

**Why:** "`a.AnchorInlineLink-sc-…` fails contrast" is exact but abstract; a 200-px crop of
the actual button is instant. Lighthouse already knows every failing node's rect; we turned
the capture off for speed and never used it.

### C1. Where it runs, and the cost
`AnalyzeOptions.captureElements?: boolean` → `WorkerInput.captureElements`. The worker sets
`disableFullPageScreenshot: !(captureElements && categories.includes('accessibility'))` —
only the **static** group (simulate, no timing) ever captures; the timed performance run
stays untouched. Only the socket path (a person watching, `depth: 'deep'`) passes `true`;
nightly/REST do not (storage, and nobody looks). Measure the static-group duration with and
without on the same page (the worker comment says the capture cost ~1–2 s; in fast mode
that group runs in parallel with the timed one, so check whether it moves the
`analysis:partial` timing at all).

### C2. Cropping — in the worker, with the Chrome that is already there
No native image dependency. After `lighthouse()` returns, while `browser` is still open:
1. Collect targets from `result.lhr.audits`: score < 0.9, `details.items` first **3** with
   `node.lhId` present in `lhr.fullPageScreenshot.nodes`, skip zero-size or off-canvas
   rects, **≤ 24 crops per run**. (Inline this; the worker cannot import lhr-transform.)
2. `const page = await browser.newPage(); await page.setViewport({ width: shot.width,
   height: Math.min(shot.height, 8000), deviceScaleFactor: 1 }); await page.setContent(
   '<img src="<data url>" style="display:block;margin:0">')`, wait for the image; per
   target `page.screenshot({ type: 'jpeg', quality: 70, encoding: 'base64',
   captureBeyondViewport: true, clip })` with the rect padded by 12 px, minimum 48×32,
   **capped at 480×320** centred on the rect (a full-width banner becomes its middle
   slice — fine, the selector names it). Verify on the first live run that rects map 1:1
   to screenshot pixels (LH captures at DPR 1; if they don't, scale by
   `shot.width / viewportWidth` once and note it here).
3. Post `elementShots: Record<lhId, string>` (data URIs) alongside `lhr`, and **delete
   `lhr.fullPageScreenshot` before `postMessage`** — the whole-page webp can be megabytes
   and nothing downstream needs it.
4. Any failure in this block logs and yields no shots; the audit itself never fails.

### C3. Transform + storage
- `AuditDetail.screenshot?: string` (jpeg data URI, ≤ ~25 KB each by construction).
- `extractAuditDetails(details, shots?)` attaches by `item.node.lhId`;
  `extractFailingAudits`/`buildFullResult` thread the map through (optional param, all
  existing callers unchanged). Static LHR only.
- `probes/lib/aiFixture.mts` `trimForAi` must drop `screenshot`; confirm
  `services/ai/pageContext.ts` prints detail fields explicitly (it does — selector /
  snippet / url / value) so a data URI never reaches a prompt. Same check for
  `askQuestion.service.ts`.
- Budget: 24 × ≤25 KB = 600 KB worst case; typical pages 5–10 crops. Log the total in the
  probe; if bbc.com lands > 300 KB, lower quality to 60 before lowering the cap.

### C4. UI
In the Phase-B detail list: thumbnail (max 140×90, `object-fit: cover`, border
`ld-border`, rounded) left of the selector; click → shared `Modal` lightbox with the full
crop and the selector + snippet beneath. Public report gets it for free (persisted).

### C5. Verification
`probes/element-shots.probe.mts` — live socket audit of a page with known a11y failures
(`https://landau.cubicsbms.com` per the fixtures, or `testlandau`) asserting ≥ 3 details
carry a `screenshot`, each < 40 KB, total < 400 KB, and that the stored History row has
them; `e2e/element-shots.probe.mjs` — thumbnails visible, lightbox opens, both themes.
Also assert `analysis:partial` for the static group did not get slower by more than 2 s
(log before/after). Stop; report; wait.


### C6. DONE — 2026-08-22

**Shipped as designed.** What the plan got right: cropping in the worker with the Chrome
that just ran the audit (no native image dependency, no second process), the static group
only, the socket path only, and deleting the whole-page capture before `postMessage`.

**What it did not anticipate:**
- **Lighthouse reports the screenshot size in fractional CSS pixels** (`728.7179565429688`).
  Puppeteer's viewport and clip both demand integers and *throw* on a fraction — so the
  first working version produced exactly zero crops on every page, and the `.catch` around
  the capture turned that into silence. Floored now, and the catch logs instead of
  swallowing. Worth remembering as a shape of bug: a feature that "produces nothing" and a
  feature that is switched off look identical from the outside.
- **A second cap was needed, in the transform.** The worker bounds what it *takes* (3 per
  audit, 24 per run), but one node can be blamed by several audits — a button that fails
  both contrast and accessible-name — and every detail row carries its own copy of the data
  URI. `extractAuditDetails` now spends a shared budget (`SHOTS_PER_RESULT = 24`, 3 per
  audit), so a crop taken once cannot be stored a dozen times.
- **The auth-audit path has no crops.** `analyzeWithInjectedSession` measures through a
  live browser rather than the worker, so it never reaches the cropping step. Left alone:
  duplicating the crop logic outside the worker to serve the login-walled path is a poor
  trade, and that path's users are looking at a page they can already see.

**Measured**
- `e2e/fixtures/inaccessible.html` (the fixture from phase B, served by the probe):
  **+0.2 s, +27 KB**, 13 crops, largest 7 KB, mean 2 KB, 9 distinct.
- `bbc.com/news`: **+0.1 s, +11 KB**, zero crops — its failures are all network-level, so
  there is nothing to photograph. The capture is still taken and thrown away, and even on a
  page that heavy it does not show up in the wall time, because the static group runs in
  parallel with the timed one in Fast mode. That is the whole reason only that group captures.

**Verified**
- `probes/element-shots.probe.mts` — **11/11 PASS** on the fixture, **9/11 + 2 honest SKIPs**
  on bbc.com/news. Runs the same page with and without the flag and prints both costs;
  asserts the per-audit and per-run caps, that every crop is a JPEG data URI under 40 KB,
  that the crops differ from one another (identical pictures would mean the rect was
  ignored), that each sits on a row that also names the element in words, and that
  `fullPageScreenshot` is not shipped.
- `e2e/element-shots.probe.mjs` — **16/16 PASS**: 13 thumbnails, all inline JPEGs, all
  decoded (`naturalWidth > 0` — a broken crop would be 0×0), none over the cap, each with
  an alt naming its selector, lazily loaded, 9 distinct; the lightbox opens at full size and
  closes on Escape; both themes; zero console errors.
- `trimForAi` strips `screenshot` from the AI fixture set, and `pageContext` prints detail
  fields by name (selector, snippet, url, value) — a data URI cannot reach a prompt.
- Gates: build, typecheck (6 workspaces), test (113), lint 0 errors, `pnpm e2e` 21/21.

---

## Phase D — JavaScript bundle treemap (~1–1.5 days)

**Why:** "Reduce unused JavaScript — 612 KB" is a number; "lodash 71 KB, 64 % unused, in
`vendor.js`" is a fix. Lighthouse computes this from source maps + coverage on every
performance run (`script-treemap-data`); we drop it.

### D1. Shared type
```ts
export interface BundleNode { name: string; bytes: number; unusedBytes?: number; children?: BundleNode[] }
export interface ScriptBundle {
  url:            string
  bytes:          number        // resourceBytes
  transferBytes?: number        // encodedBytes
  unusedBytes?:   number
  hasSourceMap:   boolean       // children present in LH's node
  root?:          BundleNode    // pruned module tree, only when hasSourceMap
}
export interface BundleSummary {
  scripts:     ScriptBundle[]   // heaviest first
  totalBytes:  number
  unusedBytes: number
  duplicates?: { module: string; bytes: number; count: number }[]
}
// on AnalysisResult:
bundles?: BundleSummary
```

### D2. Backend — `services/bundle-parser.ts` (new, same shape as the other parsers)
- Input: `performanceLhr.audits['script-treemap-data']?.details.nodes`. First confirm in
  a probe that the audit is present with our `onlyCategories: ['performance']` run (it is
  an auditRef of that category; it needs `SourceMaps`/`JsUsage`, both default gatherers).
- Prune per script: depth ≤ 3; keep children covering ≥ 1 % of the script's bytes or the
  top 25 by bytes, fold the rest into one `(other)` node carrying the remainder (bytes and
  unusedBytes both); overall ≤ 400 nodes per result. Collapse single-child chains the way
  LH's treemap app does (`src/components/…/x.js` → one node).
- Duplicates: aggregate `duplicatedNormalizedModuleName` across scripts → top 10.
- Skip inline scripts under 2 KB. Keep results deterministic (sort by bytes, then name).
- `buildFullResult`: `result.bundles = parseBundles(performanceLhr)` when non-empty.
- Measure: bbc.com / vite.dev before-after `fullResult` size; budget ≤ +10 % from this
  phase (prune harder before raising the cap).

### D3. Frontend — `features/analyzer/ui/BundleTreemap.tsx` + `lib/treemap.ts`
- `lib/treemap.ts`: squarified layout (Bruls et al.), pure, unit-tested: areas sum to the
  container, no overlaps, stable order. Hand-rolled SVG like the other analyzer
  visualisations (FlameChart, CLSVisualizer) — not recharts, which the analyzer does not
  use and whose `Treemap` cannot draw the unused-bytes overlay we want.
- Panel (in the Resources column, after `ResourceBreakdown`): header "JavaScript · 612 KB
  · 41 % unused" with `GlossaryTip`; tiles per script sized by `bytes`, a hatched/`ld-rose`
  band for the unused fraction, label + KB when the tile is wide enough. Click a script
  with a source map → drill into its modules (breadcrumb "All › vendor.js › node_modules");
  no source map → tile shows unused % and a footnote "Serve source maps to see modules".
  Hover → tooltip (name, bytes, unused bytes/%, duplicate marker). Keyboard: tiles are
  buttons. Colours from existing tokens only (`--ld-*`), no rgba literals (see
  `e2e/tint-scale.probe.mjs` — components write no rgba).
- Duplicates list under the map when present ("react-dom appears in 2 bundles, 130 KB").
- Renders nothing when `data.bundles` is absent (old results, no JS pages).

### D4. AI hook (small, optional, after D3 is verified)
`pageContext.ts`: a "Largest unused modules" block — top 5 `(script › module, KB unused)`
— so `analysePage` can name a package instead of a file. Re-run
`probes/ai-quality.probe.mts --runs 2` on the fixture set; keep only if concreteness does
not drop (the fixtures need `--retrim`/re-capture since `trimForAi` must learn the field).

### D5. Verification
`probes/bundles.probe.mts` — live audit of `https://vite.dev/guide/` (real source maps are
unlikely; `https://react.dev` or PerfScope's own dashboard on 5173 serves them in dev) —
asserts `bundles.scripts.length > 0`, a script with `hasSourceMap`, pruning caps honoured,
size delta logged; unit tests for `treemap.ts`; `e2e/bundle-treemap.probe.mjs` — panel
renders, drill-down works, both themes. Stop; report; wait.

---

## Order, estimates, and what stays out

| Phase | Feature | Est. | Depends on |
|---|---|---|---|
| A | Delta vs. previous run | 1 d | — |
| B | Category / search / groups / details rendered | 1 d | — |
| C | Element screenshots | 1 d | B (the detail slot) |
| D | Bundle treemap | 1–1.5 d | — |

Out of scope, deliberately: comparing two arbitrary history rows (the compare page does
URLs, the project page has `CompareBar`); screenshots on nightly runs; a Lighthouse-style
full treemap app; storing the full-page screenshot; source-map upload.

## Traps already known

- `lighthouse.worker.ts`: no relative value imports; type-only imports are fine.
- Head vs. tail truncation — selectors and URLs carry the identifying part at the end.
- `AnalysisResult` field names are `flameChartData` / `heapMemoryData` / `interactionData`.
- `tsc --noEmit` in web-dashboard checks nothing — use `-p tsconfig.app.json`.
- `.lean()` bypasses `toJSON` transforms; History `fullResult` is `Mixed` — anything
  written on `result` is stored verbatim, including a forgotten data URI.
- The analyzer panel is shared with the public report page: a feature that needs auth
  (e.g. fetching something per user) would break there — keep everything on `result`.
- Commit only on the user's word, no trailer.
