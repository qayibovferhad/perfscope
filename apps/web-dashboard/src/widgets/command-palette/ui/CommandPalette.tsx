import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, CornerDownLeft } from 'lucide-react';
import { usePaletteStore } from '@/shared/model/paletteStore';
import { useCommands, type Command } from '../model/useCommands';
import { match } from '../lib/match';

/** Long enough to reach everything, short enough that the list is still scannable. */
const MAX_RESULTS = 12;

/** Ranked, grouped, and capped — the order the palette actually renders. */
function useResults(commands: Command[], query: string): Command[] {
  return useMemo(() => {
    const scored = commands
      .map((command) => {
        const onLabel = match(command.label, query);
        // The hint is searchable but worth less: matching a URL is a weaker signal of
        // intent than matching the name someone would have said.
        const onHint = command.hint ? match(command.hint, query) : null;
        if (!onLabel && !onHint) return null;
        return { command, score: Math.max(onLabel?.score ?? -Infinity, (onHint?.score ?? -Infinity) - 40) };
      })
      .filter((r): r is { command: Command; score: number } => r !== null);

    // A stable sort keeps the source order — sites, then pages, then actions — for the
    // empty query and for every tie, so the list does not reshuffle as you type.
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_RESULTS).map(r => r.command);
  }, [commands, query]);
}

export function CommandPalette() {
  const { open, setOpen, toggle } = usePaletteStore();
  const commands = useCommands();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useResults(commands, query);

  // ⌘K / Ctrl-K from anywhere, including out of an input: the palette is the one thing
  // that should still answer while you are halfway through typing a URL somewhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Every opening starts blank. A palette that remembers the last thing typed makes the
  // second use a deletion before it can be a search.
  useEffect(() => {
    if (open) { setQuery(''); setActive(0); }
  }, [open]);

  // The highlight has to stay inside the list; typing narrows it from under the cursor.
  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, results]);

  function choose(command: Command | undefined) {
    if (!command) return;
    setOpen(false);
    command.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % Math.max(results.length, 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => (i - 1 + results.length) % Math.max(results.length, 1)); }
    if (e.key === 'Enter')     { e.preventDefault(); choose(results[active]); }
    if (e.key === 'Escape')    { e.preventDefault(); setOpen(false); }
  }

  // Grouped only for the headings; the flat `results` order is what the keyboard walks,
  // so the arrow keys and the eye agree.
  let lastGroup = '';

  // Kept mounted while closed — the shortcut listener above is the reason, and it also
  // lets the exit animation actually play instead of the card vanishing on unmount.
  return createPortal(
    <AnimatePresence>
      {open && (
      <motion.div
        key="palette-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4"
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.985 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          role="dialog" aria-modal="true" aria-label="Command palette"
          className="w-[min(560px,100%)] rounded-[16px] border border-ld-border-strong bg-ld-surface shadow-[0_40px_120px_-30px_rgba(0,0,0,.65)] overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-ld-border">
            <Search className="w-4 h-4 text-ld-text-3 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search sites, pages and actions…"
              className="flex-1 bg-transparent outline-none text-[14px] text-ld-text placeholder:text-ld-text-3"
            />
            <kbd className="text-[10px] font-mono font-bold text-ld-text-3 border border-ld-border rounded px-1.5 py-0.5">ESC</kbd>
          </div>

          <div ref={listRef} className="max-h-[min(52vh,380px)] overflow-y-auto py-1.5">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ld-text-3">
                Nothing matches “{query}”.
              </p>
            ) : results.map((command, i) => {
              const heading = command.group !== lastGroup ? command.group : null;
              lastGroup = command.group;
              const Icon = command.icon;
              const isActive = i === active;
              return (
                <div key={command.id}>
                  {heading && (
                    <p className="px-4 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-ld-text-3">
                      {heading}
                    </p>
                  )}
                  <button
                    data-active={isActive}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(command)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      isActive ? 'bg-ld-accent-soft' : ''
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-ld-accent' : 'text-ld-text-3'}`} />
                    <span className={`flex-1 truncate text-[13px] ${isActive ? 'text-ld-text font-semibold' : 'text-ld-text-2'}`}>
                      {command.label}
                    </span>
                    {command.hint && (
                      <span className="hidden sm:block max-w-[180px] truncate text-[10px] font-mono text-ld-text-3">
                        {command.hint}
                      </span>
                    )}
                    {isActive && <CornerDownLeft className="w-3 h-3 text-ld-accent shrink-0" />}
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
