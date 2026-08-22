import { useState } from 'react';
import { Modal, ModalHeader } from '@/shared/ui/modal';
import { CopySnippet } from '@/shared/ui/copy-snippet';
import { Crosshair } from 'lucide-react';
import type { AuditDetail } from '@/entities/analysis';

/**
 * The elements, files and numbers Lighthouse blamed — the evidence behind one finding.
 *
 * The backend has collected this since the AI work (`extractAuditDetails`), and until now
 * only the model ever saw it: the reader got "Background and foreground colors do not have
 * a sufficient contrast ratio" and had to go find the element themselves. These are the
 * same strings the AI is told to quote, so a person can check its sentence against them.
 *
 * Capped at five server-side and shown whole here — a finding with three hundred unlabelled
 * images explains itself in three.
 */
export function AuditDetails({ details }: { details: AuditDetail[] | undefined }) {
  const [zoomed, setZoomed] = useState<AuditDetail | null>(null);

  if (!details || details.length === 0) return null;

  return (
    <div className="mt-[12px] grid gap-[10px] max-w-[70ch]">
      <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3 m-0">
        Failing elements
      </p>

      {details.map((d, i) => (
        <div key={i} className="flex gap-[10px] items-start">
          {/* A selector says which element; the crop says what it looks like. The picture
              leads because recognising a button takes no reading at all. */}
          {d.screenshot && (
            <button
              type="button"
              onClick={() => setZoomed(d)}
              title="Open the full crop"
              className="shrink-0 p-0 border border-ld-border rounded-[9px] overflow-hidden bg-ld-surface-2 cursor-zoom-in hover:border-ld-accent-line transition-colors"
            >
              <img
                src={d.screenshot}
                alt={d.selector ? `Screenshot of ${d.selector}` : 'Screenshot of the failing element'}
                loading="lazy"
                className="block max-w-[140px] max-h-[90px] object-cover"
              />
            </button>
          )}

          <div className="grid gap-[5px] min-w-0 flex-1">
            {/* The selector and the URL are the two things worth copying into an editor or a
                devtools console, so both get the copy affordance; the snippet and the value
                are for reading. */}
            {d.selector && <CopySnippet text={d.selector} size="sm" />}
            {d.url && !d.selector && <CopySnippet text={d.url} size="sm" />}
            {d.url && d.selector && (
              <p className="font-mono text-[11.5px] text-ld-text-3 truncate m-0" title={d.url}>{d.url}</p>
            )}
            {d.snippet && (
              // Markup can be arbitrarily wide; it scrolls inside its own box rather than
              // widening the report.
              <pre className="m-0 px-[10px] py-[6px] rounded-[9px] border border-ld-border bg-ld-surface-2 overflow-x-auto">
                <code className="font-mono text-[11px] text-ld-text-2 whitespace-pre">{d.snippet}</code>
              </pre>
            )}
            {d.value && (
              <p className="font-mono text-[11.5px] text-ld-text-2 m-0">{d.value}</p>
            )}
          </div>
        </div>
      ))}

      <Modal open={zoomed !== null} onClose={() => setZoomed(null)} size="wide">
        <div data-lightbox className="p-[24px] grid gap-[16px]">
          <ModalHeader
            icon={<Crosshair className="w-[20px] h-[20px]" />}
            title="Failing element"
            subtitle="Cropped from the page as Lighthouse saw it during the audit."
          />
          {zoomed?.screenshot && (
            <img
              src={zoomed.screenshot}
              alt={zoomed.selector ? `Screenshot of ${zoomed.selector}` : 'Screenshot of the failing element'}
              className="block max-w-full rounded-[12px] border border-ld-border"
            />
          )}
          {zoomed?.selector && <CopySnippet text={zoomed.selector} />}
          {zoomed?.snippet && (
            <pre className="m-0 px-[12px] py-[10px] rounded-[10px] border border-ld-border bg-ld-surface-2 overflow-x-auto">
              <code className="font-mono text-[12px] text-ld-text-2 whitespace-pre">{zoomed.snippet}</code>
            </pre>
          )}
        </div>
      </Modal>
    </div>
  );
}
