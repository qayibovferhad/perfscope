/**
 * `script-treemap-data` → what the page's JavaScript is actually made of.
 *
 * Lighthouse runs this audit on every performance pass — it is an auditRef of the
 * performance category with weight 0 and group "hidden", which is why nobody noticed it —
 * and builds it from source maps plus JS coverage. Its `details.nodes` is one entry per
 * script, with a module tree underneath wherever a source map was available.
 *
 * PerfScope threw all of it away and told the reader "Reduce unused JavaScript — 612 KB".
 * This is the difference between that sentence and "lodash, 71 KB, 64% of it never
 * executed, inside vendor.js".
 *
 * The pruning here is the whole design. A treemap of every module in a real application is
 * thousands of rectangles, most of them a pixel wide: unreadable on screen and heavy in a
 * document that already carries a trace and a filmstrip. Each script keeps the modules that
 * are actually a meaningful share of it and folds the rest into one honest `(other)` node,
 * so the totals still add up.
 */
import type { BundleNode, BundleSummary, ScriptBundle } from '@perfscope/shared';

/** Lighthouse's own node shape, which is what `details.nodes` holds. */
interface TreemapNode {
  name:                           string
  resourceBytes?:                 number
  encodedBytes?:                  number
  unusedBytes?:                   number
  duplicatedNormalizedModuleName?: string
  children?:                      TreemapNode[]
}

/** How deep the module tree goes. Three levels is `node_modules → package → file`, which is
 *  the depth at which a name still means something to the person reading it. */
const MAX_DEPTH = 3;

/** A child worth its own rectangle is either a real share of its parent, or one of the few
 *  biggest. Below both, it is a sliver nobody can click and a name nobody can read. */
const MIN_SHARE = 0.01;
const MAX_CHILDREN = 25;

/** Whole-result ceiling, so a monstrous application cannot put a megabyte of tree into a
 *  stored audit. Scripts are visited heaviest first, so what gets dropped is the tail.
 *  Every emitted node counts, folds included — an uncounted fold node per parent is how
 *  the first version of this quietly produced 601 nodes against a cap of 400. */
const MAX_NODES = 400;

/**
 * How many scripts get a module tree at all.
 *
 * A dev server serves the application unbundled: 179 separate scripts, each with a source
 * map, each wanting a tree. Nobody reads the 40th, and the summary was 16% of the stored
 * result. The heaviest twenty is where every real finding lives; the rest are still listed
 * with their sizes, just without an interior.
 */
const MAX_SCRIPTS_WITH_MODULES = 20;

/** An inline script smaller than this is a snippet — an analytics tag, a theme toggle —
 *  and listing it beside a 300KB bundle says nothing about where the weight is. */
const MIN_INLINE_BYTES = 2 * 1024;

/** Modules that appear in more than one bundle, and are worth naming. */
const MAX_DUPLICATES = 10;

/** Lighthouse's placeholders for "no source map covered this" and "this was written inline". */
const isSynthetic = (name: string) => name === '(unmapped)' || name.startsWith('(inline)');

/**
 * Collapse a chain of single-child directories into one node.
 *
 * A source tree is mostly `src/components/widgets/…`, and drawing four nested rectangles
 * of identical size to reach one file wastes the space the map has. Lighthouse's own
 * treemap app does the same thing, for the same reason.
 */
function collapse(node: TreemapNode): { name: string; node: TreemapNode } {
  let name = node.name;
  let current = node;
  while (current.children?.length === 1 && current.children[0]!.children?.length) {
    const only = current.children[0]!;
    name = `${name}/${only.name}`;
    current = only;
  }
  return { name, node: current };
}

interface PruneBudget { left: number }

/**
 * A node's children, pruned. Shared by the recursion and by the top level, where the
 * script itself must *not* be collapsed into its first directory — the script's name is
 * its URL, and `vendor.js/node_modules` names nothing.
 */
function pruneChildren(parentBytes: number, children: TreemapNode[], depth: number, budget: PruneBudget): BundleNode[] | undefined {
  if (depth > MAX_DEPTH || children.length === 0) return undefined;
  // Nothing left to spend, not even on the fold that would keep the sums right — so this
  // node stays a leaf. A leaf is drawn at its own full size, which is still true; a
  // half-populated child list would not be.
  if (budget.left <= 0) return undefined;

  // Biggest first, so the cut always falls on the smallest things.
  const sorted = [...children].sort((a, b) => (b.resourceBytes ?? 0) - (a.resourceBytes ?? 0));
  const kept: BundleNode[] = [];
  let foldedBytes = 0;
  let foldedUnused = 0;
  let foldedCount = 0;

  for (const [i, child] of sorted.entries()) {
    const childBytes = child.resourceBytes ?? 0;
    const worthKeeping = i < MAX_CHILDREN && (parentBytes === 0 || childBytes / parentBytes >= MIN_SHARE);
    // One node is always held back for the fold, so whatever is skipped from here on still
    // has somewhere to go.
    const pruned = worthKeeping && budget.left > 1 ? pruneNode(child, depth, budget) : null;
    if (pruned) {
      kept.push(pruned);
    } else {
      // Folded, not dropped: the rectangles still have to add up to the script.
      foldedBytes += childBytes;
      foldedUnused += child.unusedBytes ?? 0;
      foldedCount++;
    }
  }

  if (foldedCount > 0 && foldedBytes > 0) {
    // If the fold itself cannot be afforded, this level gets no children at all rather
    // than a list that does not add up. The budget already spent on the kept nodes is
    // wasted, which is the cheaper of the two mistakes and only happens at the very tail.
    if (budget.left <= 0) return undefined;
    budget.left--;
    kept.push({
      name: `(${foldedCount} smaller ${foldedCount === 1 ? 'module' : 'modules'})`,
      bytes: foldedBytes,
      ...(foldedUnused ? { unusedBytes: foldedUnused } : {}),
    });
  }

  return kept.length > 0 ? kept : undefined;
}

/** One Lighthouse node and its descendants, pruned to what a person can read. */
function pruneNode(raw: TreemapNode, depth: number, budget: PruneBudget): BundleNode | null {
  if (budget.left <= 0) return null;
  budget.left--;

  const { name, node } = collapse(raw);
  const bytes = node.resourceBytes ?? 0;

  const self: BundleNode = {
    name,
    bytes,
    ...(node.unusedBytes ? { unusedBytes: node.unusedBytes } : {}),
  };

  const children = pruneChildren(bytes, node.children ?? [], depth + 1, budget);
  if (children) self.children = children;
  return self;
}

/** Modules a source map actually named — `(unmapped)` and `(inline)` are placeholders. */
function hasRealModules(node: TreemapNode): boolean {
  return (node.children ?? []).some(c => !isSynthetic(c.name));
}

function collectDuplicates(nodes: TreemapNode[]): BundleSummary['duplicates'] {
  const seen = new Map<string, { bytes: number; count: number }>();

  const walk = (node: TreemapNode) => {
    const dupe = node.duplicatedNormalizedModuleName;
    if (dupe) {
      const entry = seen.get(dupe) ?? { bytes: 0, count: 0 };
      entry.bytes += node.resourceBytes ?? 0;
      entry.count += 1;
      seen.set(dupe, entry);
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of nodes) walk(node);

  const duplicates = [...seen]
    // A module "duplicated" in one place is Lighthouse marking it, not a finding.
    .filter(([, v]) => v.count > 1)
    .map(([module, v]) => ({ module, bytes: v.bytes, count: v.count }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, MAX_DUPLICATES);

  return duplicates.length > 0 ? duplicates : undefined;
}

export function parseBundles(lhr: {
  audits?: Record<string, { details?: unknown }>
}): BundleSummary | undefined {
  const details = lhr.audits?.['script-treemap-data']?.details as { nodes?: TreemapNode[] } | undefined;
  const nodes = details?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return undefined;

  const budget: PruneBudget = { left: MAX_NODES };

  const scripts: ScriptBundle[] = [];
  let treesBuilt = 0;
  // Heaviest first, so the pruning budget is spent where the weight is.
  for (const node of [...nodes].sort((a, b) => (b.resourceBytes ?? 0) - (a.resourceBytes ?? 0))) {
    const bytes = node.resourceBytes ?? 0;
    if (bytes <= 0) continue;

    // A page's own document appears here as the holder of its inline scripts. Worth
    // listing only when those inline scripts amount to something. Note the `length > 0`:
    // a *file* with no children at all is an ordinary minified script with no source map,
    // and dropping it as "inline" would hide the heaviest thing on some pages.
    const children = node.children ?? [];
    const inlineOnly = children.length > 0 && children.every(c => c.name.startsWith('(inline)'));
    if (inlineOnly && bytes < MIN_INLINE_BYTES) continue;

    const sourceMapped = hasRealModules(node);
    const script: ScriptBundle = {
      url: node.name,
      bytes,
      hasSourceMap: sourceMapped,
      ...(node.encodedBytes ? { transferBytes: node.encodedBytes } : {}),
      ...(node.unusedBytes ? { unusedBytes: node.unusedBytes } : {}),
    };

    if (sourceMapped && treesBuilt < MAX_SCRIPTS_WITH_MODULES) {
      // Pruned from the children directly, not through `pruneNode(node)`: that would
      // collapse the script into its first directory and lose the URL as the label.
      const modules = pruneChildren(bytes, children, 1, budget);
      if (modules) {
        script.modules = modules;
        treesBuilt++;
      }
    }

    scripts.push(script);
  }

  if (scripts.length === 0) return undefined;

  const duplicates = collectDuplicates(nodes);

  return {
    scripts,
    totalBytes:  scripts.reduce((sum, s) => sum + s.bytes, 0),
    unusedBytes: scripts.reduce((sum, s) => sum + (s.unusedBytes ?? 0), 0),
    ...(duplicates ? { duplicates } : {}),
  };
}
