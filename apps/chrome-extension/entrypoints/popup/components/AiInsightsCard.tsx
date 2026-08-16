/**
 * The one AI card the popup gets — phase 6 of docs/ai/PLAN.md. Every other surface in
 * this product (the dashboard, the CLI) already shows `analysePage`'s commentary; the
 * extension was the one place `analysis:insights` was received and thrown away.
 *
 * Deliberately just the headline text, not the full per-audit/per-vital breakdown the
 * dashboard's `AiCard` renders — the popup is ~360px wide and closes the moment it loses
 * focus, so this is the one sentence someone glancing at it actually reads.
 */
interface Props {
  text: string
}

export function AiInsightsCard({ text }: Props) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-ld-surface border border-ld-accent-line">
      <div className="flex items-center gap-1.5">
        <SparkleIcon />
        <span className="text-[10px] text-ld-accent uppercase tracking-widest font-semibold">AI Insights</span>
      </div>
      <p className="text-[11px] text-ld-text-2 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  )
}

function SparkleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-ld-accent shrink-0">
      <path d="M12 2l1.8 5.9L20 9.5l-6.2 1.6L12 17l-1.8-5.9L4 9.5l6.2-1.6L12 2z" />
    </svg>
  )
}
