import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The popup's one full-width call to action — Analyze Page, Run Comparison.
 *
 * Both tabs spelled the same eight utilities out inline and had drifted only on the glow
 * radius (18px against 16px), which is a difference nobody could see. The glow is
 * suppressed while the action is running so a pending button does not look pressable.
 *
 * The extension has no Button primitive of its own and does not import the dashboard's —
 * different app, different bundle — so this is the local one.
 */
export function PrimaryButton(
  { children, loading, className = '', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; loading?: boolean },
) {
  return (
    <button
      {...rest}
      className={
        'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold ' +
        'text-[var(--ld-grad-text)] bg-[image:var(--ld-grad)] transition-all duration-200 ' +
        'disabled:opacity-40 disabled:cursor-not-allowed ' +
        (loading ? '' : '[box-shadow:0_0_16px_var(--ld-accent-line)] ') +
        className
      }
    >
      {children}
    </button>
  )
}
