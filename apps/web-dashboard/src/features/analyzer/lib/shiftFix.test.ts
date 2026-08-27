import { describe, it, expect } from 'vitest';
import { shiftFix } from './shiftFix';

/**
 * The rule table behind every "how to fix this shift" line in the CLS panel.
 *
 * Worth testing precisely because it is not AI: it is instant, free and right about the
 * handful of causes behind nearly every layout shift, and it is a stack of regexes that
 * would go on producing confident sentences after any one of them stopped matching.
 */
describe('shiftFix', () => {
  it('says nothing prescriptive about a shift too small to be worth acting on', () => {
    expect(shiftFix('img.hero', '<img>', 0.001)).toMatch(/low impact/i);
    // Even when a root cause is known: the advice is real, the shift is not worth it.
    expect(shiftFix('img.hero', '<img>', 0.001, 'unsized-media')).toMatch(/low impact/i);
  });

  it('prefers the root cause Lighthouse identified over guessing from the selector', () => {
    // The selector says "font", the root cause says the media was unsized — the cause wins.
    expect(shiftFix('.font-hero', '<img class="font-hero">', 0.2, 'unsized-media'))
      .toMatch(/width and height/i);
    expect(shiftFix('div', '<div>', 0.2, 'web-font')).toMatch(/font-display: optional/);
    expect(shiftFix('div', '<div>', 0.2, 'injected-iframe')).toMatch(/iframe/i);
  });

  it('reads the selector and the snippet together when there is no root cause', () => {
    expect(shiftFix('img.banner', '<img src="a.png">', 0.2)).toMatch(/width and height/i);
    expect(shiftFix('#ad-slot-1', '<div>', 0.2)).toMatch(/min-height/i);
    expect(shiftFix('.video-player', '<div>', 0.2)).toMatch(/aspect-ratio/i);
    expect(shiftFix('header.hero', '<header>', 0.2)).toMatch(/fixed height or aspect-ratio/i);
  });

  it('does not tell an already-sized image to be sized', () => {
    expect(shiftFix('img', '<img width="800" height="600">', 0.2)).not.toMatch(/^Set explicit width/);
  });

  it('always answers something actionable', () => {
    expect(shiftFix('', '', 0.2)).toMatch(/aspect-ratio or min-height/i);
  });
});
