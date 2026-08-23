import { useState } from 'react';
import { Compass, Loader2, Check, AlertCircle } from 'lucide-react';
import { fetchJson } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import type { DiscoveredRoute, RouteDiscovery as Discovery } from '@perfscope/shared';

interface Props {
  siteId: string;
  /** Already on the schedule — shown ticked and inert rather than hidden, so the list
   *  reads as the whole site and not as a mysteriously incomplete one. */
  existing: string[];
  onAdd: (paths: string[]) => void;
}

/**
 * "Read the site's sitemap and let me tick the pages I care about."
 *
 * The manual field stays: plenty of sites have no sitemap, and the pages worth watching
 * (a checkout step, a route behind a login) are often exactly the ones absent from it.
 * This is the shortcut for the common case, not a replacement for typing.
 */
export function RouteDiscovery({ siteId, existing, onAdd }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [found, setFound] = useState<DiscoveredRoute[]>([]);
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function run() {
    setState('loading');
    setReason('');
    try {
      // `fetchJson` already unwraps `{ success, data }` — the payload arrives bare.
      const res = await fetchJson<Discovery>(`/websites/${siteId}/routes`);
      const routes = res.routes.filter(r => !existing.includes(r.path));
      setFound(routes);
      setReason(res.reason ?? (routes.length === 0 ? 'Every page in the sitemap is already on the list.' : ''));
      // Pre-ticking the whole list would make "Add" a thing you undo rather than a thing
      // you aim: the point of the picker is choosing a handful out of eighty.
      setPicked(new Set());
      setState('done');
    } catch {
      setFound([]);
      setReason('Could not reach the site to read its sitemap.');
      setState('done');
    }
  }

  const toggle = (path: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (!next.delete(path)) next.add(path);
    return next;
  });

  if (state === 'idle') {
    return (
      <button
        onClick={run}
        className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-ld-text-3 hover:text-ld-accent transition-colors"
      >
        <Compass className="w-3 h-3" /> Find routes from sitemap
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-ld-text-3">
        <Loader2 className="w-3 h-3 animate-spin" /> Reading the sitemap…
      </p>
    );
  }

  if (found.length === 0) {
    return (
      <div className="mt-2 flex items-start gap-1.5 text-[10px] text-ld-text-3">
        <AlertCircle className="w-3 h-3 mt-px shrink-0" />
        <span>
          {reason}{' '}
          <button onClick={run} className="font-semibold text-ld-accent hover:underline">Try again</button>
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[10px] border border-ld-border bg-ld-surface-2 overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-ld-border">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ld-text-3">
          {found.length} found · {picked.size} selected
        </p>
        <button
          onClick={() => setPicked(picked.size === found.length ? new Set() : new Set(found.map(r => r.path)))}
          className="text-[10px] font-semibold text-ld-accent hover:underline"
        >
          {picked.size === found.length ? 'Clear' : 'Select all'}
        </button>
      </div>

      {/* Capped so a hundred-page sitemap scrolls inside the modal instead of moving the
          buttons below it off the screen. */}
      <div className="max-h-[168px] overflow-y-auto">
        {found.map(r => {
          const on = picked.has(r.path);
          return (
            <button
              key={r.path}
              onClick={() => toggle(r.path)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-ld-surface-hover transition-colors"
            >
              <span className={`w-3.5 h-3.5 shrink-0 rounded-[4px] grid place-items-center border transition-colors ${
                on ? 'bg-ld-accent border-ld-accent' : 'border-ld-border-strong'
              }`}>
                {on && <Check className="w-2.5 h-2.5 text-[#04130d]" strokeWidth={3} />}
              </span>
              <span className="flex-1 truncate text-[11px] font-mono text-ld-text-2">{r.path}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-2.5 py-2 border-t border-ld-border">
        <Button
          size="sm" variant="secondary" className="h-7 text-[11px]"
          disabled={picked.size === 0}
          onClick={() => { onAdd([...picked]); setState('idle'); setFound([]); setPicked(new Set()); }}
        >
          Add {picked.size > 0 ? picked.size : ''} {picked.size === 1 ? 'route' : 'routes'}
        </Button>
        <button
          onClick={() => { setState('idle'); setFound([]); setPicked(new Set()); }}
          className="text-[10px] font-semibold text-ld-text-3 hover:text-ld-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
