/**
 * The fix for a shift, from its root cause and selector.
 *
 * This was called `aiSuggestion` and rendered under an "AI suggestion" heading, and it is
 * not AI — it is the rule table below, which is exactly why it is worth keeping: it is
 * instant, free, and right about the handful of causes that produce nearly every shift.
 * With real Gemini commentary now sitting a few sections up the same report, the label was
 * the only dishonest part, so the label is what went.
 */
export function shiftFix(selector: string, snippet: string, score: number, rootCause?: string): string {
  if (score < 0.005)
    return 'Low impact shift. Focus on higher priority stability issues first.';
  if (rootCause === 'unsized-media')
    return 'Set explicit width and height attributes on the media element so the browser can reserve space before it loads.';
  if (rootCause === 'web-font')
    return 'Use font-display: optional or preload the font to prevent text-swap layout shifts.';
  if (rootCause === 'injected-iframe')
    return 'Add explicit width and height to the iframe or reserve its space with a fixed-size wrapper before injection.';

  const s = (selector + ' ' + snippet).toLowerCase();
  if (/\bimg\b/.test(s) && !/width=|height=|aspect-ratio/.test(s))
    return 'Set explicit width and height attributes on this image so the browser can reserve space before it loads.';
  if (/iframe/.test(s))
    return 'Add width and height to the iframe; browsers cannot reserve space for unknown-size embeds.';
  if (/\bad[-_ ]|advertisement|adsense|adslot/.test(s))
    return 'Reserve a fixed min-height for this ad container before the ad script injects content.';
  if (/font|woff|webfont/.test(s))
    return 'Use font-display: optional or preload the font to prevent text-swap layout shifts.';
  if (/video|player/.test(s))
    return 'Wrap this video in an aspect-ratio container so layout is reserved before the player renders.';
  if (/hero|banner|header/.test(s))
    return 'Lock this hero/banner to a fixed height or aspect-ratio so page flow is stable during load.';
  return 'Set an explicit aspect-ratio or min-height so the browser reserves space before dynamic content arrives.';
}
