/**
 * The RUM collector, served verbatim at GET /rum.js.
 *
 * Kept as a string rather than a static file because the backend runs from src/ under
 * tsx in dev and from dist/ in production; a template literal cannot get lost between
 * the two, and there is no build step to teach about .js assets.
 *
 * Constraints this code lives under — it executes on someone else's site:
 *   - never throw: every observer is wrapped, a broken collector must not break a page
 *   - never block: no synchronous work beyond registering observers
 *   - send exactly once per page view, on the way out, via sendBeacon
 *   - carry no PII: path only, never the query string, no identifiers, no cookies
 */

/** Bumped when the beacon shape changes, so old payloads stay diagnosable server-side. */
export const RUM_COLLECTOR_VERSION = 1;

export const RUM_COLLECTOR_JS = `(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-perfscope-key]');
  var key    = script && script.getAttribute('data-perfscope-key');
  if (!key || !window.PerformanceObserver) return;

  var endpoint = (script.getAttribute('data-perfscope-endpoint') || '').replace(/\\/$/, '');
  if (!endpoint) {
    try { endpoint = new URL(script.src).origin + '/api/rum'; } catch (e) { return; }
  }

  var data = { key: key, path: location.pathname || '/', v: ${RUM_COLLECTOR_VERSION} };
  data.device = (window.innerWidth || 1024) < 768 ? 'mobile' : 'desktop';

  // ── TTFB ────────────────────────────────────────────────────────────────────
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.responseStart > 0) data.ttfb = Math.round(nav.responseStart);
  } catch (e) {}

  function observe(type, cb, opts) {
    try {
      var po = new PerformanceObserver(function (list) { cb(list.getEntries(), po); });
      po.observe(Object.assign({ type: type, buffered: true }, opts || {}));
      return po;
    } catch (e) { return null; }
  }

  // ── FCP ─────────────────────────────────────────────────────────────────────
  observe('paint', function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name === 'first-contentful-paint') data.fcp = Math.round(entries[i].startTime);
    }
  });

  // ── LCP ─────────────────────────────────────────────────────────────────────
  // The last entry wins, and the metric freezes at the first interaction — after that
  // any new "largest" paint is a consequence of the user, not of load performance.
  var lcpFrozen = false;
  observe('largest-contentful-paint', function (entries) {
    if (lcpFrozen) return;
    var last = entries[entries.length - 1];
    if (last) data.lcp = Math.round(last.startTime);
  });
  ['keydown', 'click'].forEach(function (type) {
    addEventListener(type, function () { lcpFrozen = true; }, { once: true, capture: true });
  });

  // ── CLS ─────────────────────────────────────────────────────────────────────
  // Not a plain sum: Core Web Vitals scores the worst *session window* — shifts
  // separated by more than 1s of quiet, or longer than 5s, start a new window.
  var clsValue = 0, windowValue = 0, windowFirst = 0, windowLast = 0;
  observe('layout-shift', function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry.hadRecentInput) continue;   // user-driven shifts do not count

      if (windowValue &&
          entry.startTime - windowLast  < 1000 &&
          entry.startTime - windowFirst < 5000) {
        windowValue += entry.value;
        windowLast   = entry.startTime;
      } else {
        windowValue = entry.value;
        windowFirst = entry.startTime;
        windowLast  = entry.startTime;
      }
      if (windowValue > clsValue) clsValue = windowValue;
    }
    data.cls = Math.round(clsValue * 1000) / 1000;
  });

  // ── INP (approximated) ──────────────────────────────────────────────────────
  // True INP is a high percentile of all interactions; with one page view to report
  // there is nothing to take a percentile of, so this reports the worst interaction.
  // That is the conservative reading — never flatters the page.
  var worstInteraction = 0;
  observe('event', function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var d = entries[i].duration;
      if (d > worstInteraction) { worstInteraction = d; data.inp = Math.round(d); }
    }
  }, { durationThreshold: 40 });

  // ── Report ──────────────────────────────────────────────────────────────────
  var sent = false;
  function report() {
    if (sent) return;
    // Nothing measured means nothing worth a request — a bounce before first paint.
    if (data.lcp === undefined && data.fcp === undefined && data.ttfb === undefined) return;
    sent = true;

    var body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, body)) return;
    } catch (e) {}
    try {
      fetch(endpoint, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' });
    } catch (e) {}
  }

  // visibilitychange is the reliable end-of-view signal on mobile, where unload never
  // fires; pagehide covers the bfcache path.
  addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') report();
  }, true);
  addEventListener('pagehide', report, true);
})();
`;
