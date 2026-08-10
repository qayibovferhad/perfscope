interface Props {
  size?: number
  className?: string
}

export function LoadingSpinner({ size = 20, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="var(--ld-accent-soft)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--ld-accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
