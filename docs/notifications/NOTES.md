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
