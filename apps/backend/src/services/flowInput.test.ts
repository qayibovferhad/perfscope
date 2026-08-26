import { describe, it, expect } from 'vitest';
import { parseFlowInput } from './flowInput.js';

const base = { name: 'Checkout', url: 'https://example.com/checkout' };
const click = { action: 'click', selector: '#pay' };

describe('parseFlowInput — the definition', () => {
  it('keeps a well-formed flow', () => {
    const flow = parseFlowInput({ ...base, steps: [click] });
    expect(flow).toMatchObject({ name: 'Checkout', url: 'https://example.com/checkout', formFactor: 'desktop', snapshotAtEnd: true });
    expect(flow.steps).toEqual([{ action: 'click', selector: '#pay', measure: true }]);
  });

  it('refuses a flow with no steps', () => {
    // Without a step this is a navigation audit wearing a costume, and the analyzer does
    // that better — accepting it would put a second, worse audit path in the product.
    expect(() => parseFlowInput({ ...base, steps: [] })).toThrow(/at least one step/i);
    expect(() => parseFlowInput({ ...base, steps: 'nope' })).toThrow(/must be an array/);
  });

  it('refuses a URL this server would not open', () => {
    expect(() => parseFlowInput({ ...base, url: 'file:///etc/passwd', steps: [click] })).toThrow(/http/);
    expect(() => parseFlowInput({ ...base, url: '', steps: [click] })).toThrow(/http/);
  });

  it('caps the number of steps', () => {
    const steps = Array.from({ length: 21 }, () => click);
    expect(() => parseFlowInput({ ...base, steps })).toThrow(/At most 20 steps/);
  });
});

describe('parseFlowInput — the steps', () => {
  it('rejects an unknown action rather than skipping it', () => {
    // Silently dropping a step gives a flow that looks configured and measures something
    // else — the failure mode this whole parser exists to prevent.
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'swipe' }] })).toThrow(/action must be one of/);
  });

  it('demands a selector for the actions that point at an element', () => {
    for (const action of ['click', 'type', 'hover', 'waitFor']) {
      expect(() => parseFlowInput({ ...base, steps: [{ action, value: 'x' }] }), action)
        .toThrow(/needs a CSS selector/);
    }
  });

  it('demands a value for the actions whose value is the instruction', () => {
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'type', selector: '#email' }] })).toThrow(/needs a value/);
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'press' }] })).toThrow(/needs a value/);
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'navigate' }] })).toThrow(/needs a value/);
  });

  it('names the step that is wrong', () => {
    // "Step 2: click needs a CSS selector" is a sentence somebody can act on; "invalid
    // flow" is not, and the editor highlights the row from this number.
    expect(() => parseFlowInput({ ...base, steps: [click, { action: 'click' }] }))
      .toThrow(/^Step 2: /);
  });

  it('holds a navigate step to the same URL bar as the flow itself', () => {
    // It is a second address this server will open, so it is checked like the first.
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'navigate', value: 'not-a-url' }] }))
      .toThrow(/http\(s\) URL/);
    expect(parseFlowInput({ ...base, steps: [{ action: 'navigate', value: 'https://example.com/next' }] }).steps[0])
      .toMatchObject({ action: 'navigate', value: 'https://example.com/next' });
  });

  it('bounds a wait — a flow that sleeps a minute holds a Chrome hostage', () => {
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'wait', value: '60000' }] })).toThrow(/between 1 and 15000/);
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'wait', value: '0' }] })).toThrow(/between 1 and 15000/);
    expect(parseFlowInput({ ...base, steps: [{ action: 'wait', value: '500' }] }).steps).toHaveLength(1);
    // No value at all is the documented default, not an error.
    expect(parseFlowInput({ ...base, steps: [{ action: 'wait' }] }).steps[0]).toMatchObject({ action: 'wait' });
  });

  it('measures a step unless it is explicitly told not to', () => {
    // Absence must not read as "plumbing": a flow whose steps all quietly went unmeasured
    // would report one number for the navigation and nothing else.
    expect(parseFlowInput({ ...base, steps: [click] }).steps[0]?.measure).toBe(true);
    expect(parseFlowInput({ ...base, steps: [{ ...click, measure: false }] }).steps[0]?.measure).toBe(false);
    expect(parseFlowInput({ ...base, steps: [{ ...click, measure: 'no' }] }).steps[0]?.measure).toBe(true);
  });

  it('trims and bounds what it stores', () => {
    const flow = parseFlowInput({ ...base, steps: [{ action: 'click', selector: '  #pay  ', name: '  Pay  ' }] });
    expect(flow.steps[0]).toMatchObject({ selector: '#pay', name: 'Pay' });
    expect(() => parseFlowInput({ ...base, steps: [{ action: 'click', selector: 'a'.repeat(400) }] })).toThrow(/too long/);
  });
});

describe('parseFlowInput — the rest of the definition', () => {
  it('takes mobile only when asked, and ignores junk', () => {
    expect(parseFlowInput({ ...base, steps: [click], formFactor: 'mobile' }).formFactor).toBe('mobile');
    expect(parseFlowInput({ ...base, steps: [click], formFactor: 'watch' }).formFactor).toBe('desktop');
  });

  it('snapshots the final state unless told otherwise', () => {
    expect(parseFlowInput({ ...base, steps: [click] }).snapshotAtEnd).toBe(true);
    expect(parseFlowInput({ ...base, steps: [click], snapshotAtEnd: false }).snapshotAtEnd).toBe(false);
  });

  it('links a website only when the id looks like one', () => {
    expect(parseFlowInput({ ...base, steps: [click], websiteId: 'abc' })).not.toHaveProperty('websiteId');
    expect(parseFlowInput({ ...base, steps: [click], websiteId: '6a8dfcb581013fc9ef1ef72d' }))
      .toHaveProperty('websiteId', '6a8dfcb581013fc9ef1ef72d');
  });
});
