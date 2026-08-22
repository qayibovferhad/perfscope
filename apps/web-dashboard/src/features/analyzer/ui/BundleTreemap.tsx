import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Boxes, ChevronRight, Layers } from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/ui/panel';
import { fmtBytes } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { squarify } from '../lib/treemap';
import { resourceFilename } from '../lib/waterfall';
import type { BundleNode, BundleSummary, ScriptBundle } from '@/entities/analysis';

/**
 * The map is laid out in real pixels, not in viewBox units.
 *
 * A `viewBox` with `preserveAspectRatio="none"` would be less code, but it scales x and y
 * by different factors the moment the container is not exactly the viewBox's aspect — and
 * that squashes every label, which is the one thing on this chart that must stay legible.
 * So the container is measured and the geometry is computed at its true size.
 */
const HEIGHT = 320;

/** A tile smaller than this cannot hold a label without it spilling into its neighbour. */
const LABEL_MIN = { width: 78, height: 30 };

/** Unused share at which a bundle is worth colouring as a problem rather than as weight. */
const UNUSED_WARN = 0.4;

interface Tile {
  key:      string
  name:     string
  bytes:    number
  unused:   number
  /** Set when this tile can be opened — a script with modules, or a node with children. */
  drillTo?: BundleNode[]
  /** Set on script tiles, for the subtitle and the "no source map" note. */
  script?:  ScriptBundle
}

function nodeTiles(nodes: BundleNode[], prefix: string): Tile[] {
  return nodes.map((n, i) => ({
    key:    `${prefix}/${n.name}/${i}`,
    name:   n.name,
    bytes:  n.bytes,
    unused: n.unusedBytes ?? 0,
    ...(n.children?.length ? { drillTo: n.children } : {}),
  }));
}

function scriptTiles(scripts: ScriptBundle[]): Tile[] {
  return scripts.map((s, i) => ({
    key:    `${s.url}/${i}`,
    name:   resourceFilename(s.url),
    bytes:  s.bytes,
    unused: s.unusedBytes ?? 0,
    script: s,
    ...(s.modules?.length ? { drillTo: s.modules } : {}),
  }));
}

/**
 * What the page's JavaScript is made of, drawn to scale.
 *
 * Lighthouse computes this on every performance run — `script-treemap-data`, built from
 * source maps and coverage — and PerfScope dropped it on the floor for a year. The audit
 * list could say "Reduce unused JavaScript — 612 KB" and nothing else; this says which
 * bundle, and where a source map exists, which package inside it.
 *
 * The hatched part of each tile is the code that never ran during the load. That is the
 * number worth acting on: weight you paid for and did not use.
 */
export function BundleTreemap({ bundles }: { bundles: BundleSummary | undefined }) {
  const [path, setPath] = useState<{ label: string; nodes: BundleNode[] }[]>([]);
  const [hovered, setHovered] = useState<Tile | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // SVG ids are document-global: two of these on one page (a compare view, later) would
  // have the second one's tiles clipped by the first one's rectangles.
  const clipId = useId().replace(/:/g, '');

  // Measured, then kept in step with the sidebar collapsing and the window resizing.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.clientWidth);
  }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      setWidth(w => (Math.abs(w - next) > 1 ? next : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const level = path.at(-1);

  const tiles = useMemo<Tile[]>(() => {
    if (!bundles) return [];
    return level ? nodeTiles(level.nodes, level.label) : scriptTiles(bundles.scripts);
  }, [bundles, level]);

  const rects = useMemo(
    () => (width > 0 ? squarify(tiles.map(t => ({ value: t.bytes })), { x: 0, y: 0, width, height: HEIGHT }) : []),
    [tiles, width],
  );

  if (!bundles || bundles.scripts.length === 0) return null;

  const unusedShare = bundles.unusedBytes / Math.max(1, bundles.totalBytes);

  return (
    <Panel>
      <PanelHeader
        icon={<Boxes className="w-[15px] h-[15px]" />}
        title="JavaScript"
        meta={`${bundles.scripts.length} ${bundles.scripts.length === 1 ? 'script' : 'scripts'} · ${fmtBytes(bundles.totalBytes)} parsed · ${Math.round(unusedShare * 100)}% never executed`}
      />

      <div className="px-[18px] pb-[16px]">
        {/* Breadcrumb — always present, so the way back out is never hidden. */}
        <div className="flex items-center gap-[4px] flex-wrap mb-[10px] font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setPath([])}
            className={cn(
              'bg-transparent border-0 p-0 cursor-pointer',
              path.length === 0 ? 'text-ld-text-2' : 'text-ld-accent hover:underline',
            )}
          >
            All scripts
          </button>
          {path.map((step, i) => (
            <span key={step.label} className="flex items-center gap-[4px]">
              <ChevronRight className="w-[12px] h-[12px] text-ld-text-3" aria-hidden />
              <button
                type="button"
                onClick={() => setPath(p => p.slice(0, i + 1))}
                className={cn(
                  'bg-transparent border-0 p-0 cursor-pointer truncate max-w-[240px]',
                  i === path.length - 1 ? 'text-ld-text-2' : 'text-ld-accent hover:underline',
                )}
                title={step.label}
              >
                {step.label}
              </button>
            </span>
          ))}
        </div>

        <div ref={wrap} className="w-full">
        <svg
          width={width || undefined}
          height={HEIGHT}
          className="block rounded-[10px] overflow-hidden"
          role="img"
          aria-label={`Treemap of ${bundles.scripts.length} scripts totalling ${fmtBytes(bundles.totalBytes)}`}
        >
          <defs>
            {/* Diagonal hatching reads as "not real code you are using" without needing a
                second hue, which the band tokens have already spent. */}
            <pattern id={`${clipId}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--ld-rose-soft)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ld-rose-line)" strokeWidth="3" />
            </pattern>
            {/* Only the tiles that will carry a label need one — a clip path per sliver is
                a few hundred DOM nodes that clip nothing. */}
            {rects
              .filter(r => r.width >= LABEL_MIN.width && r.height >= LABEL_MIN.height)
              .map(rect => (
                <clipPath key={rect.index} id={`${clipId}-${rect.index}`}>
                  <rect x={rect.x} y={rect.y} width={Math.max(0, rect.width - 4)} height={rect.height} />
                </clipPath>
              ))}
          </defs>

          {rects.map(rect => {
            const tile = tiles[rect.index]!;
            const share = tile.bytes > 0 ? tile.unused / tile.bytes : 0;
            const canLabel = rect.width >= LABEL_MIN.width && rect.height >= LABEL_MIN.height;
            const openable = Boolean(tile.drillTo);

            return (
              <g
                key={tile.key}
                onMouseEnter={() => setHovered(tile)}
                onMouseLeave={() => setHovered(h => (h === tile ? null : h))}
                onClick={() => tile.drillTo && setPath(p => [...p, { label: tile.name, nodes: tile.drillTo! }])}
                className={openable ? 'cursor-pointer' : 'cursor-default'}
              >
                <rect
                  x={rect.x} y={rect.y} width={rect.width} height={rect.height}
                  fill={share >= UNUSED_WARN ? 'var(--ld-amber-soft)' : 'var(--ld-accent-soft)'}
                  stroke="var(--ld-border)"
                  strokeWidth="1"
                />
                {/* The unused share, drawn from the bottom so tiles read like fill gauges. */}
                {share > 0 && (
                  <rect
                    x={rect.x}
                    y={rect.y + rect.height * (1 - share)}
                    width={rect.width}
                    height={rect.height * share}
                    fill={`url(#${clipId}-hatch)`}
                    pointerEvents="none"
                  />
                )}
                {canLabel && (
                  // Clipped to its own tile. A long package name is common and an unclipped
                  // one lands on top of the neighbouring tile's label, which reads as two
                  // interleaved words and belongs to neither.
                  <g clipPath={`url(#${clipId}-${rect.index})`}>
                    <text
                      x={rect.x + 7} y={rect.y + 16}
                      className="font-mono fill-ld-text text-[11px]"
                      pointerEvents="none"
                    >
                      {tile.name}
                    </text>
                    <text
                      x={rect.x + 7} y={rect.y + 30}
                      className="font-mono fill-ld-text-3 text-[10px]"
                      pointerEvents="none"
                    >
                      {fmtBytes(tile.bytes)}{share > 0 ? ` · ${Math.round(share * 100)}% unused` : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        </div>

        {/* Readout. Fixed height so hovering does not move the page under the cursor. */}
        <div className="mt-[10px] min-h-[38px]">
          {hovered ? (
            <div>
              <p className="font-mono text-[12px] text-ld-text m-0 truncate" title={hovered.script?.url ?? hovered.name}>
                {hovered.script?.url ?? hovered.name}
              </p>
              <p className="font-mono text-[11px] text-ld-text-3 m-0">
                {fmtBytes(hovered.bytes)} parsed
                {hovered.script?.transferBytes ? ` · ${fmtBytes(hovered.script.transferBytes)} over the wire` : ''}
                {hovered.unused > 0 ? ` · ${fmtBytes(hovered.unused)} never executed` : ''}
                {hovered.drillTo ? ' · click to open' : ''}
                {hovered.script && !hovered.script.hasSourceMap ? ' · no source map, so no module breakdown' : ''}
              </p>
            </div>
          ) : (
            <p className="font-mono text-[11px] text-ld-text-3 m-0">
              Hatched area is code that never ran during the load. Hover a tile for detail
              {tiles.some(t => t.drillTo) ? '; click one to see inside it' : ''}.
            </p>
          )}
        </div>

        {/* Duplicates — the finding a treemap alone cannot show, because the two copies sit
            in different rectangles and look like two different modules. */}
        {bundles.duplicates && bundles.duplicates.length > 0 && (
          <div className="mt-[14px] pt-[14px] border-t border-ld-border">
            <p className="flex items-center gap-[6px] font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3 mb-[7px] m-0">
              <Layers className="w-[12px] h-[12px]" aria-hidden />
              Shipped more than once
            </p>
            <ul className="m-0 p-0 list-none grid gap-[3px]">
              {bundles.duplicates.map(d => (
                <li key={d.module} className="font-mono text-[12px] text-ld-text-2 truncate" title={d.module}>
                  {d.module} <span className="text-ld-text-3">· in {d.count} bundles · {fmtBytes(d.bytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
