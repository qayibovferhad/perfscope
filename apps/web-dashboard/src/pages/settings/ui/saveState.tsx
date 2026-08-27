import { CheckCircle2 } from 'lucide-react';

export function SaveError({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold px-3 py-2 rounded-lg text-ld-rose border border-ld-rose-line bg-ld-rose-wash">
      {children}
    </p>
  );
}

export function SavedChip({ label = 'Saved' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ld-accent-2">
      <CheckCircle2 className="w-4 h-4" /> {label}
    </span>
  );
}
