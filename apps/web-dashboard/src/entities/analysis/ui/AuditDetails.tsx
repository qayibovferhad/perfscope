import { CopySnippet } from '@/shared/ui/copy-snippet';
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
  if (!details || details.length === 0) return null;

  return (
    <div className="mt-[12px] grid gap-[8px] max-w-[70ch]">
      <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-ld-text-3 m-0">
        Failing elements
      </p>
      {details.map((d, i) => (
        <div key={i} className="grid gap-[5px]">
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
      ))}
    </div>
  );
}
