import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page:       number;
  totalPages: number;
  total:      number;
  limit:      number;
  onChange:   (page: number) => void;
}

/**
 * Builds a compact page list with ellipses, e.g. 1 … 4 [5] 6 … 20.
 * `null` marks a gap.
 */
function pageList(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ page, totalPages, total, limit, onChange }: Props) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const navCls = 'w-9 h-9 grid place-items-center rounded-[10px] border border-ld-border text-ld-text-2 transition-all duration-200 hover:border-ld-accent-line hover:text-ld-accent disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div className="flex items-center justify-between gap-4 mt-[26px] flex-wrap">
      <span className="text-[12.5px] text-ld-text-3">
        Showing <b className="font-mono text-ld-text-2">{from}–{to}</b> of{' '}
        <b className="font-mono text-ld-text-2">{total}</b>
      </span>

      <div className="flex items-center gap-[6px]">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={navCls}
        >
          <ChevronLeft className="w-[15px] h-[15px]" />
        </button>

        {pageList(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="w-6 text-center text-[13px] text-ld-text-3">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`min-w-9 h-9 px-2 grid place-items-center rounded-[10px] border font-mono text-[13px] transition-all duration-200 ${
                p === page
                  ? 'border-ld-accent-line bg-ld-accent-soft text-ld-accent font-semibold'
                  : 'border-ld-border text-ld-text-2 hover:border-ld-accent-line hover:text-ld-accent'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={navCls}
        >
          <ChevronRight className="w-[15px] h-[15px]" />
        </button>
      </div>
    </div>
  );
}
