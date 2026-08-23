# Notifications — the toaster and the bell

Written 2026-08-23. Two surfaces, one job: the app could not say "that worked" and could
not say "something happened while you were away".

## The toaster

`shared/ui/toast/` — written from scratch, no dependency. `toastStore.ts` holds the state
and the `toast` API; `Toaster.tsx` renders it; the countdown lives in `index.css`.

```ts
toast.success('Share link copied', { description: '…', action: { label: 'Open it', onClick } })
toast.error('Audit failed', { description: '…' })
const id = toast.loading('Running audit…')
toast.success('Audit complete', { id })   // promotes that card, does not stack a second
toast.promise(p, { loading, success, error })
```

**A plain function, not a hook.** Most of the places worth announcing something are not
components — an API error handler, a socket callback, a mutation's `onError` — and a rule
that says "only from a component" is a rule that gets worked around.

**The progress bar *is* the timer.** `Toaster` dismisses a toast from the bar's
`onAnimationEnd`, so there is no JS timer to keep in step with a CSS animation. Hovering
sets `animation-play-state: paused` and both stop together; a JS timer beside a CSS bar
would leave a toast vanishing under a stopped progress indicator. The same rule covers
`:focus-within` (a keyboard user reading the action) and a backgrounded tab — CSS
animations keep running on a hidden document, so `Toaster` watches `visibilitychange` and
pauses the stack, otherwise a toast raised while you were in another tab is gone when you
come back.

Other decisions worth not re-litigating:
- **Portalled to `document.body`.** The shell clips and scrolls its own columns; a `fixed`
  element inside a transformed ancestor is positioned against that ancestor.
- **Top centre, newest first.** The right-hand corner is spoken for — the advisor rail, the
  ask-about-this-audit button, and on a phone both at once — and a stack squeezed past
  furniture lands somewhere different on every screen size. The top of the page is the same
  place everywhere; cards enter downwards from the edge they sit on.
- **`version` is in the React key** so promoting a toast restarts the countdown — otherwise
  a `loading` promoted to `success` inherits the elapsed wait and vanishes instantly.
- **Four at once**, oldest dropped: past that it is a wall, and the oldest is the one
  already read.
- **`aria-live="polite"` on the region, `role="alert"` only on errors.** A confirmation is
  not an interruption.
- Swipe right to dismiss (`drag="x"`), and everything above degrades under
  `prefers-reduced-motion`.

**Where it is wired** (deliberately few — a notification system stops being read the moment
it is noisy): the share link (success with an *Open it* action, and the real reason on
failure, which used to be silent); adding and removing a site (the two writes with nothing
else on screen to confirm them); an audit failing; and an audit *finishing* only when
`document.visibilityState === 'hidden'` — announcing a result to someone watching it appear
is noise.

## The bell

`features/notifications/`, in the sidebar's brand row. `GET /api/notifications` and
`POST /api/notifications/seen`, served by `services/notifications.service.ts`.

**Unread is one timestamp on the account** (`User.alertsSeenAt`), not a flag per alert: it
cannot drift out of step with the log, needs no write when an alert is raised, and survives
pruning. The trade is that unread is per account rather than per device, which is right for
a tool people open on one screen. The count is taken over the whole log, not over the
returned page, or an account with thirty new alerts would show twenty and stay there.

**Opening the panel marks things seen, not receiving them.** The query refetches on a timer
and on focus; clearing the badge on a refetch would clear it while the tab sat in the
background. The mutation is optimistic — the badge is the thing being looked at when it is
clicked.

**The panel is portalled too**, for a reason worth remembering: the sidebar is
`overflow-y-auto`, and a scroll container clips its children in *both* axes, so a 340px
dropdown inside a 288px sidebar is cut off whichever side it is anchored to. Escaping the
container is the only fix; the price is that a click inside the panel is not a click inside
the bell, so the click-away checks both.

`ALERT_EVENT_LABEL` moved to `packages/shared/src/lib/alerts.ts` — the dashboard's incident
list and the bell now show the same alerts and must call them the same thing. The keys are
stored event names and cannot be renamed without orphaning open incidents.

`--ld-accent-wash` was added to complete the tint scale amber and rose already had; the
unread row needed something quieter than `soft` at .12.

## Verified

`e2e/notifications.probe.mjs` — **30/30 PASS**. The toaster: appears, announced politely,
errors as alerts, self-dismisses, hover pauses the countdown (asserted on the computed
`animation-play-state`, then on the toast still being there two seconds past its duration),
loading does not time out, promotion updates one card, the stack caps at four keeping the
newest, the close button works. The bell: the badge counts three seeded alerts, the panel
names breach/recovery/regression in words and carries the line that was actually sent, it
is fully on screen at a readable width, clicking inside does not close it, outside and
Escape do, opening clears the badge and it stays clear across a reload. Screenshots in both
themes.

---

# The dashboard on a phone (2026-08-23)

Measured before touching anything: at 390×844 **no route overflowed** — the shell has had a
drawer and a mobile topbar for a long time. What was wrong was proportion and reachability,
which a scrollWidth check cannot see:

- The **bell** was only in the sidebar, which on a phone is a drawer. A badge nobody can see
  without opening a drawer is a badge that does not work. It is now in the mobile topbar too.
- The **Analyze button** was pushed past the edge of its own card; the device and precision
  toggles clipped "Precise". The form stacks below `sm` and the toggle row wraps.
- The **waterfall's name column** is a fixed pixel width shared with the flame chart's axis.
  At 280–320px of a 390px screen it left seventy pixels for the bars, which are the entire
  point. `LEFT_W_NARROW = 132` under 640px, via `useMediaQuery` — a number, not a class,
  because the flame chart below draws from the same one and the two must agree. At that
  width the row drops the type badge and the byte count (both a tap away in the detail
  panel) so the *filename* survives, and the column header drops them with it.
- **Four full-width stat cards** were most of a screen of scrolling before the page said
  anything. Two-up, with a smaller glyph and tighter padding so the labels still fit.
- **Panel headers** shredded "Resource Dependency Chain" into a three-line column with its
  meta in a second column and a chip clipped off the edge. The row wraps now, title first.
- The **ask-about-this-audit button** floated at bottom-*left*, which is where a line of
  text begins. On narrow screens it moves right, clear of the advisor rail, and the toaster
  lifts above it. `main` also gained bottom padding under 2xl so the floating rail cannot
  permanently cover the last inch of a page.
- **Segmented controls** scroll horizontally instead of squeezing: five category chips were
  breaking "Best practices 2" onto two lines and making the control taller than the rows it
  filters.
- Fixed in `e2e/helpers.mjs` while here: the auth-seeding script ran on `about:blank`, where
  `localStorage` throws, and that exception surfaced as a page error in every probe that
  asserts "no console errors".

**Verified** — `e2e/mobile-layout.probe.mjs`, **20/20 PASS** at 390×844 against a real audit:
topbar reachability, the drawer, two-up stats, the form's geometry, the toggles' last option,
the name column as a fraction of its panel, filenames still legible, no title over three
lines, and no bleed on eight routes. Screenshots at four scroll positions.

---

# Running audits in the shell (2026-08-23)

An audit takes tens of seconds and nobody watches it: people start one and go look at
something else. The run existed only on the page that started it, and that page — once left
— gave no sign it had ever been running. `adoptRunning` had been able to re-attach to a live
run for months; nothing ever told anyone there was one to re-attach to.

`entities/analysis/model/runningAuditsStore.ts` holds what is in flight. Two renderings:
the sidebar gets a row per run with the server's own progress message and a bar, the mobile
topbar gets a pulsing icon and a count.

**The tracker is its own permanent subscription, not a hook into the callers' listeners.**
That is the whole design. The point of the indicator is the case where the caller has gone —
leaving the analyzer detaches its handlers while the audit carries on — so a tracker built on
those handlers would freeze at the last progress it saw and never see the finish. One pair of
listeners is registered on the shared socket at the first audit of the session and never
removed.

**Runs are claimed, not keyed.** The server mints the `analysisId` (so concurrent audits
cannot read each other's progress), which means the client knows a run exists a second before
it knows its name. A run starts unclaimed; the first id to arrive belongs to the oldest
unclaimed run, and after that events route by id. Twelve minutes without finishing and an
entry is pruned — the one case events cannot cover is a socket that went away and took the
completion with it.

**Compare runs are deliberately excluded.** The indicator's promise is "still going, and you
can go back and watch it". `compareSocket` creates a socket per analysis and disconnects it
with the page, so leaving compare orphans the client side of those runs — the server finishes
and stores them, and history is where they turn up. A pill offering to reopen a run that
cannot be reopened is worse than no pill.

**The pill had to be made true.** Clicking it navigates to `/app`, and the analyzer now
adopts a run in flight on arrival — before this it landed on an empty form while the audit it
had just advertised finished off screen. The URL field is seeded from the running audit in
the `useState` initialiser rather than an effect, so the first paint is already right.

**The adopted run's clock is the run's.** Adopting used to show no elapsed time at all, and
the comment in `adoptRunning` said why: the run began before the page did, so counting from
the mount would be a wrong number rather than a missing one. That reasoning stopped holding
the moment the store started recording `startedAt` — the honest number is available now, so
the clock is right even when the run is being watched from its second minute, and the stored
duration is right with it.

**A finished run is parked in two places.** The toast is where the reader was looking when
it landed; the sidebar, above Add Website and beside anything still running, is where they
come back to. Same list as the running audits, because the shell answers one question —
what has this account been doing — and a result nobody has read yet is part of that answer.
Three at most, cleared by opening one or by its ×.

**A finished run is a card, not a confirmation.** `toast` gained `onClick`, which makes the
whole card the target instead of a link inside it, and the finished-audit notification uses
it with `duration: Infinity`. A confirmation of something you just did can time out; a
*result waiting to be read* cannot — one that removes itself after four seconds while the
reader is on another page is a result they never had. Clicking anywhere on the card opens
the report; the close button and any action still stop the click from reaching it, and a
swipe is not a click (a drag past four pixels suppresses the one it produces).

**A run that finishes while nobody is looking says so.** `useFinishedAuditToast`, mounted in
the shell for the same reason the tracker is: `useAnalysis`'s listeners go when the analyzer
does, so the one case worth announcing is the one a listener there cannot see. It fires when
the tab is hidden *or* the open route is not `/app` — never for someone watching the scores
appear in front of them. It writes the result into the analyzer's store on the way past, so
"View report" lands on the report instead of an empty form; nothing else would have kept it,
because the page that normally stores it was not mounted.

**Stop had been quietly failing, and the pill is what exposed it.** The page learns a run's
`analysisId` from a *progress event*, which in Fast mode can be twenty seconds away — and a
run that has just been adopted starts with no id at all. Stop pressed in either window sent
nothing: the form reset, and the audit carried on. Nobody could see that before, because the
page that would have shown it had just reset itself; now the pill keeps counting and says so
plainly. `adoptRunning` seeds the id from the store, and `cancel` falls back to it.

A hard reload still loses the indicator: the store is in memory, and the socket reconnects as
a new client. The audit itself survives on the server and lands in history.

**Verified** — `e2e/running-audits.probe.mjs`, **25/25 PASS**: no pill when idle; a pill
naming the URL once a run starts; still there after clicking through to another route, with
progress moving (35% → 62%) while the analyzer is unmounted; a finished-audit toast on
another page carrying the score, the host and a working *View report* that lands on the
report rather than an empty form; a second run putting the pill back; clicking the pill
returning to `/app` with the run's own clock (0:05, not 0:00); the pill clearing itself on
completion while the report lands as usual; and Stop genuinely stopping the run both
straight after starting one and straight after adopting one — the two windows where the page
has no id of its own. Asserted through the DOM, because a probe that imports the store
through Vite gets its own empty copy of it.


---

# Stop (2026-08-23)

Reported four times before it was actually fixed. Recording the whole sequence, because the
*way* it went wrong is the reusable part.

The complaint was "Stop does not work: the timer resets and the analysis starts again". Five
separate defects turned out to sit behind it, and every one of my probes was green while the
report kept coming back — because every probe I wrote tested the path *I* had built, on a
throwaway account, in a fresh browser, without reloading.

1. **A cancelled audit was reported as a failure.** Killing the workers makes the run throw
   ("Worker exited with code 1", or "Failed to fetch browser webSocket URL from …/json/
   version"), and that went out as `analysis:error`. Hidden only by accident: the dashboard
   detaches its listeners before sending the cancel. The socket now remembers which of its
   own audits it was asked to stop.
2. **A queued audit could not be cancelled at all.** `activeAnalyses` is filled by the task
   *after* the queue admits it, so a waiting audit was invisible — and started the moment a
   slot opened. With the cap at two, that is the ordinary case. A cancel that finds nothing
   active now leaves a note that every queued task checks on entry.
3. **`/app?url=…` re-ran on every reload.** A deep link is an instruction; left in the
   address bar it means the same thing again. Vite reloads an open tab whenever a module
   cannot be hot-swapped, so during this very session the user's page was restarting audits
   by itself. The start parameters are consumed once acted on.
4. **The client sent nothing when it had no id.** The page learns the `analysisId` from a
   progress event; Stop pressed before that had nothing to send. `analysis:cancel` now
   accepts `null`, meaning "the run I just started", and the server resolves it against that
   socket's in-flight audits — including the case where the cancel *overtakes* the start,
   which is a real race because `analysis:start` is handled asynchronously.
5. **The saved-session path ignored cancellation entirely** — and this was the user's actual
   path, because their site has a stored login. It uses one browser rather than worker
   threads, and `browser.close()` waits politely while Lighthouse holds the connection:
   measured, a cancelled audit went on for another forty-five seconds. Worse, a
   `setInterval` invents progress every three seconds to show the run is alive, and it kept
   doing so for the cancelled run — the bar climbed from 35% to 74% after Stop. Chrome is
   killed by pid now, as the worker path always did, the ticker stops itself, and the run
   loop checks before and after every pass.

6. **And the one the report was actually about: Stop submitted the form.** The Stop and
   Analyze buttons are one conditional slot, so React reused the same `<button>` node and
   mutated its `type` from "button" to "submit" while the click was still being handled.
   The browser then ran the default action for the element as it had become. Cancel, then
   an identical start in the same tick — on screen, a counter resetting to zero and
   climbing again, in both the page and the shell's pill. Distinct keys make them two
   elements, so the node the pointer pressed is gone rather than repurposed.

   **This is why every probe was green.** They clicked with `element.click()`, which does
   not go through the same default-action path as a pointer. `page.mouse.click()`
   reproduced it on the first try. Any probe asserting that a click *does not* do something
   has to use a real pointer.

**The lesson, which cost hours:** when a report contradicts a green probe, the question is
what the reporter's setup does that the probe does not. Here it was three things at once — a
saved session, a reloading tab, and a queue — and none of them were in any test. Checking the
reporter's own data (`websites.session` was set on both their sites) took thirty seconds and
should have been the first move, not the last.

**Verified** — `probes/cancel-audit.probe.mts`: cancellation swept across 0/150/400/900/
1800/3000/5000/8000 ms with none surviving, both audit paths (worker and saved-session), an
audit cancelled while queued behind two others, a genuine failure still reported, and two
connections not silencing each other.
