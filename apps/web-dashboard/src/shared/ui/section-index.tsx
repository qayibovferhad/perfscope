import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/utils';

export interface IndexedSection { id: string; label: string }

/**
 * A numbered rail down the side of a long settings-style page, marking where you are.
 *
 * A page of four or five stacked panels has no structure a reader can see: everything is
 * the same box, and the only way to find "signed-in devices" is to scroll past everything
 * else. The rail names the sections, numbers them the way the page header numbers the
 * route, and follows the scroll.
 *
 * Plain anchors, so a section is linkable and the keyboard reaches it — the highlight is
 * an `IntersectionObserver` on top, never the thing that does the navigating.
 */
export function SectionIndex({
  sections, className,
}: { sections: IndexedSection[]; className?: string }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    const nodes = sections
      .map(s => document.getElementById(s.id))
      .filter((n): n is HTMLElement => n !== null);
    if (!nodes.length) return;

    // The band is the top third of the viewport: a section counts as "the one you are
    // reading" once its head reaches there, which is where the eye actually sits. Keyed
    // on the *topmost* intersecting node so scrolling up marks the section you arrive in,
    // not the one you are leaving.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-12% 0px -66% 0px', threshold: 0 },
    );

    nodes.forEach(n => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Sections" className={cn('sticky top-[24px] self-start', className)}>
      <ul className="flex flex-col">
        {sections.map((section, i) => {
          const isActive = section.id === active;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'group flex items-center gap-[11px] py-[8px] border-l transition-colors duration-150 pl-[14px]',
                  isActive
                    ? 'border-[var(--ld-accent)] text-ld-text'
                    : 'border-ld-border text-ld-text-3 hover:text-ld-text-2 hover:border-ld-border-strong',
                )}
              >
                <span className="font-mono text-[10.5px] tabular-nums text-ld-text-3">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[13px] font-medium truncate">{section.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
