import { describe, it, expect } from 'vitest';
import { parseBundles } from './bundle-parser.js';

const KB = 1024;

interface Node { name: string; resourceBytes?: number; encodedBytes?: number; unusedBytes?: number; duplicatedNormalizedModuleName?: string; children?: Node[] }

const lhrWith = (nodes?: Node[]) =>
  ({ audits: nodes ? { 'script-treemap-data': { details: { nodes } } } : {} });

/** Sum every rectangle at one level — the invariant the folding exists to protect. */
const sumBytes = (nodes: { bytes: number }[] = []) => nodes.reduce((s, n) => s + n.bytes, 0);

describe('parseBundles', () => {
  it('is undefined when the audit did not run', () => {
    // Only the performance pass carries script-treemap-data; the static group never does.
    expect(parseBundles(lhrWith())).toBeUndefined();
    expect(parseBundles(lhrWith([]))).toBeUndefined();
  });

  it('lists a script with its sizes and whether a source map named its modules', () => {
    const summary = parseBundles(lhrWith([{
      name: 'https://a.test/vendor.js', resourceBytes: 300 * KB, encodedBytes: 90 * KB, unusedBytes: 120 * KB,
      children: [{ name: 'node_modules/lodash/index.js', resourceBytes: 200 * KB, unusedBytes: 120 * KB }],
    }]));

    expect(summary?.scripts[0]).toMatchObject({
      url: 'https://a.test/vendor.js', bytes: 300 * KB, transferBytes: 90 * KB,
      unusedBytes: 120 * KB, hasSourceMap: true,
    });
    expect(summary?.totalBytes).toBe(300 * KB);
    expect(summary?.unusedBytes).toBe(120 * KB);
  });

  it('marks a script with no real modules as unmapped and gives it no tree', () => {
    // `(unmapped)` is Lighthouse's placeholder for "no source map covered this" — drawing
    // it as a module would claim knowledge nobody has.
    const summary = parseBundles(lhrWith([{
      name: 'https://a.test/min.js', resourceBytes: 90 * KB,
      children: [{ name: '(unmapped)', resourceBytes: 90 * KB }],
    }]));
    expect(summary?.scripts[0]).toMatchObject({ hasSourceMap: false });
    expect(summary?.scripts[0]?.modules).toBeUndefined();
  });

  it('keeps a minified script that has no children at all', () => {
    // The `children.length > 0` guard: a file with no children is an ordinary script with
    // no source map, and treating it as an inline holder would hide the heaviest thing on
    // some pages.
    const summary = parseBundles(lhrWith([{ name: 'https://a.test/app.js', resourceBytes: 400 }]));
    expect(summary?.scripts.map(s => s.url)).toEqual(['https://a.test/app.js']);
  });

  it('skips a document whose inline scripts are just snippets', () => {
    const summary = parseBundles(lhrWith([
      { name: 'https://a.test/', resourceBytes: 900, children: [{ name: '(inline) theme-toggle', resourceBytes: 900 }] },
      { name: 'https://a.test/app.js', resourceBytes: 50 * KB },
    ]));
    expect(summary?.scripts.map(s => s.url)).toEqual(['https://a.test/app.js']);
  });

  it('keeps a document whose inline scripts add up to real weight', () => {
    const summary = parseBundles(lhrWith([
      { name: 'https://a.test/', resourceBytes: 40 * KB, children: [{ name: '(inline) big', resourceBytes: 40 * KB }] },
    ]));
    expect(summary?.scripts.map(s => s.url)).toEqual(['https://a.test/']);
  });

  it('folds the modules it drops instead of losing their bytes', () => {
    // The rectangles have to add up to the script, or the map lies about where the weight is.
    const children = Array.from({ length: 60 }, (_, i) => ({ name: `mod-${i}.js`, resourceBytes: (60 - i) * KB }));
    const total = children.reduce((s, c) => s + c.resourceBytes, 0);

    const summary = parseBundles(lhrWith([{ name: 'https://a.test/app.js', resourceBytes: total, children }]));
    const modules = summary?.scripts[0]?.modules ?? [];

    expect(sumBytes(modules)).toBe(total);
    expect(modules.some(m => /smaller modules\)$/.test(m.name))).toBe(true);
  });

  it('collapses a chain of single-child directories into one label', () => {
    const summary = parseBundles(lhrWith([{
      name: 'https://a.test/app.js', resourceBytes: 100 * KB,
      children: [{
        name: 'src', resourceBytes: 100 * KB,
        children: [{ name: 'components', resourceBytes: 100 * KB, children: [{ name: 'Button.tsx', resourceBytes: 100 * KB }] }],
      }],
    }]));
    expect(summary?.scripts[0]?.modules?.[0]?.name).toBe('src/components');
  });

  it('spends its whole-result node budget on the heaviest scripts first', () => {
    // 30 scripts each wanting a tree, against a 400-node ceiling: what gets dropped has to
    // be the tail, not whatever came first in the file.
    const scripts = Array.from({ length: 30 }, (_, i) => ({
      name: `https://a.test/${i}.js`,
      resourceBytes: (i + 1) * 100 * KB,
      children: Array.from({ length: 30 }, (_, j) => ({ name: `m${j}.js`, resourceBytes: 3 * KB })),
    }));

    const summary = parseBundles(lhrWith(scripts));
    const withModules = summary?.scripts.filter(s => s.modules) ?? [];

    expect(withModules.length).toBeLessThanOrEqual(20);
    // Heaviest first: the biggest script is one of the ones that kept its interior.
    expect(withModules[0]?.url).toBe('https://a.test/29.js');
    // Every script is still listed with its size — only the interiors are rationed.
    expect(summary?.scripts).toHaveLength(30);

    const countNodes = (nodes: { children?: unknown[] }[] = []): number =>
      nodes.reduce((n, node) => n + 1 + countNodes((node.children ?? []) as { children?: unknown[] }[]), 0);
    expect(summary?.scripts.reduce((n, s) => n + countNodes(s.modules), 0)).toBeLessThanOrEqual(400);
  });

  it('names modules that really are in more than one bundle', () => {
    const summary = parseBundles(lhrWith([
      { name: 'https://a.test/a.js', resourceBytes: 50 * KB, children: [
        { name: 'lodash.js', resourceBytes: 20 * KB, duplicatedNormalizedModuleName: 'lodash' },
        { name: 'once.js',   resourceBytes: 5 * KB,  duplicatedNormalizedModuleName: 'only-here' },
      ] },
      { name: 'https://a.test/b.js', resourceBytes: 50 * KB, children: [
        { name: 'lodash.js', resourceBytes: 20 * KB, duplicatedNormalizedModuleName: 'lodash' },
      ] },
    ]));

    // A module marked in one place only is Lighthouse tagging it, not a duplication finding.
    expect(summary?.duplicates).toEqual([{ module: 'lodash', bytes: 40 * KB, count: 2 }]);
  });

  it('leaves duplicates off entirely when there are none', () => {
    const summary = parseBundles(lhrWith([{ name: 'https://a.test/a.js', resourceBytes: 10 * KB }]));
    expect(summary?.duplicates).toBeUndefined();
  });

  it('ignores zero-byte scripts', () => {
    expect(parseBundles(lhrWith([{ name: 'https://a.test/empty.js', resourceBytes: 0 }]))).toBeUndefined();
  });
});
