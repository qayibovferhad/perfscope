import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileJson, FileText, Image as ImageIcon, Copy, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';

export interface ExportMenuProps {
  onJson:      () => void;
  onImage:     () => void;
  onCopyImage: () => Promise<boolean>;
  onPdf:       () => void;
  className?:  string;
}

/**
 * The four ways to take a result out of the app, behind one button.
 *
 * They were heading for four buttons in a header that already had four. Grouped, because
 * they are one intention — "give me this to show someone" — differing only in what the
 * recipient can open.
 */
export function ExportMenu({ onJson, onImage, onCopyImage, onPdf, className }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // `mousedown`, not `click`: a click listener added during a click sees the very event
    // that opened the menu and closes it again on the same press.
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [
    { icon: ImageIcon, label: 'Download image', hint: 'PNG',  run: onImage },
    {
      icon: copied ? Check : Copy,
      label: copied ? 'Copied to clipboard' : 'Copy image',
      hint: copied ? '' : 'paste in Slack',
      // Stays open on success so the confirmation is visible where the click happened.
      run: async () => {
        if (await onCopyImage()) {
          setCopied(true);
          setTimeout(() => { setCopied(false); setOpen(false); }, 1400);
        } else {
          setOpen(false);
        }
      },
      keepOpen: true,
    },
    { icon: FileText, label: 'Print / save as PDF', hint: '', run: onPdf },
    { icon: FileJson, label: 'Export JSON', hint: 'raw result', run: onJson },
  ];

  return (
    <div className={`relative ${className ?? ''}`} ref={wrap}>
      <Button
        variant="outline"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="group text-[13.5px] px-[14px] py-[9px] h-auto rounded-[10px] [&_svg]:w-[15px] [&_svg]:h-[15px]"
      >
        <Download className="text-ld-text-3 group-hover:text-ld-accent transition-colors" />
        Export
        <ChevronDown className={`text-ld-text-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[236px] rounded-[12px] border border-ld-border-strong bg-ld-surface shadow-[0_28px_70px_-24px_rgba(0,0,0,.55)] overflow-hidden py-1"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => { if (!item.keepOpen) setOpen(false); void item.run(); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-ld-surface-hover transition-colors"
              >
                <Icon className="w-[15px] h-[15px] shrink-0 text-ld-text-3" />
                <span className="flex-1 text-[13px] text-ld-text-2">{item.label}</span>
                {item.hint && <span className="text-[10px] font-mono text-ld-text-3">{item.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
