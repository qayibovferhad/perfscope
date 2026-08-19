import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Clock } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/shared/lib/utils';

export interface UrlSuggestion {
  url: string;
  /** 'website' = a tracked site (shown first, labeled "Tracked"). 'history' = a page
   *  audited before but not tracked, labeled "Recent". */
  source: 'website' | 'history';
}

interface Props {
  value:        string;
  onChange:     (value: string) => void;
  suggestions:  UrlSuggestion[];
  placeholder?: string;
  disabled?:    boolean;
  icon?:        ReactNode;
  mono?:        boolean;
  autoFocus?:   boolean;
  /** The positioning root — use for flex sizing (`flex-1`); the dropdown itself is
   *  portalled and measures this element, so its own overflow never clips it. */
  className?:      string;
  /** Forwarded to the underlying `<input>` — padding/text-size tweaks. */
  inputClassName?: string;
}

const MAX_SHOWN = 6;

/**
 * A plain URL field until there's something to suggest — no entity knowledge here, the
 * caller decides what counts as a suggestion (tracked sites, past audits, anything else)
 * and hands over the flat list. Filters as the value changes, not on a separate query, so
 * the dropdown never lags a keystroke behind.
 *
 * Portalled to `document.body` and positioned from the input's own `getBoundingClientRect`
 * — both call sites (`AnalyzerSearchForm`'s `Panel`, `SideInputBar`'s own card) clip
 * overflow for their rounded corners, so an absolutely-positioned child would be cut off
 * a few pixels in. Same fix as `InfoTip`/`AskAboutAudit` for the identical failure.
 */
export function UrlCombobox({
  value, onChange, suggestions, placeholder, disabled, icon, mono, autoFocus,
  className, inputClassName,
}: Props) {
  const [open, setOpen]           = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect]           = useState<{ left: number; top: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.url.toLowerCase() !== q && s.url.toLowerCase().includes(q))
      .slice(0, MAX_SHOWN);
  }, [value, suggestions]);

  // Clamped at render rather than reset via an effect: `matches` shrinking (a keystroke
  // narrowing the list) is exactly the kind of derived-from-props change effects aren't
  // for — the active row just needs to stay a valid index into whatever the list is now.
  const activeIndex = Math.min(highlight, matches.length - 1);
  const showDropdown = open && matches.length > 0;

  function place() {
    const r = rootRef.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.bottom + 6, width: r.width });
  }

  useEffect(() => {
    if (!showDropdown) return;
    place();
    // A tooltip can just vanish on scroll; a field the user is mid-typing into
    // shouldn't lose its own dropdown from an unrelated scroll elsewhere on the page, so
    // this repositions instead of closing.
    const onScroll = () => place();
    const onResize = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [showDropdown]);

  // Close on a click outside — the same pattern InfoTip/AskAboutAudit use. Checks the
  // portalled dropdown too, since it isn't a DOM descendant of `rootRef`.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-url-combobox-list]')) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const select = (url: string) => {
    onChange(url);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Input
        icon={icon}
        mono={mono}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((activeIndex + 1) % matches.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((activeIndex - 1 + matches.length) % matches.length); }
          else if (e.key === 'Enter') {
            const m = matches[activeIndex];
            if (m) { e.preventDefault(); select(m.url); }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        disabled={disabled}
        spellCheck={false}
        autoFocus={autoFocus}
        className={inputClassName}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />

      {createPortal(
        showDropdown && rect && (
          <div
            data-url-combobox-list
            className="fixed z-[220] rounded-[12px] border border-ld-border-strong bg-ld-surface shadow-ld-shadow-card overflow-hidden py-[6px]"
            style={{ left: rect.left, top: rect.top, width: rect.width }}
          >
            {matches.map((m, i) => (
              <button
                key={m.url}
                type="button"
                // Fires before the input's blur would otherwise close the dropdown first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(m.url)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'w-full flex items-center gap-[10px] px-[14px] py-[9px] text-left transition-colors',
                  i === activeIndex ? 'bg-ld-accent-soft' : 'hover:bg-ld-surface-2',
                )}
              >
                {m.source === 'website'
                  ? <Globe className="w-[14px] h-[14px] shrink-0 text-ld-accent" />
                  : <Clock className="w-[14px] h-[14px] shrink-0 text-ld-text-3" />}
                <span className="flex-1 min-w-0 font-mono text-[13px] text-ld-text truncate">{m.url}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[.08em] text-ld-text-3">
                  {m.source === 'website' ? 'Tracked' : 'Recent'}
                </span>
              </button>
            ))}
          </div>
        ),
        document.body,
      )}
    </div>
  );
}
