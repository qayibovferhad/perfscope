import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] text-sm font-semibold transition-[transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ld-accent-line)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[image:var(--ld-grad)] text-white font-bold shadow-[0_18px_60px_-20px_rgba(20,192,138,.45)] hover:-translate-y-px hover:shadow-[0_20px_44px_-16px_rgba(20,192,138,.6)]",
        destructive:
          "bg-[var(--ld-rose)] text-white hover:opacity-90",
        outline:
          "border border-[var(--ld-border-strong)] bg-[var(--ld-surface)] text-[var(--ld-text)] hover:bg-[var(--ld-surface-hover)] hover:border-[var(--ld-accent-line)]",
        secondary:
          "bg-[var(--ld-accent-soft)] text-[var(--ld-accent)] border border-[var(--ld-accent-line)] hover:bg-[var(--ld-accent-line)]",
        ghost:
          "text-[var(--ld-text-2)] hover:bg-[var(--ld-surface-hover)] hover:text-[var(--ld-text)]",
        link: "text-[var(--ld-accent)] underline-offset-4 hover:underline",
        dark: "bg-[#04130d] text-[#eafff5] font-bold shadow-none hover:-translate-y-px hover:shadow-none",
      },
      size: {
        default: "h-11 px-6 py-3 text-[14.5px]",
        md:      "h-10 px-[14px] text-[13px] rounded-[10px]",
        sm:      "h-8 px-3 text-xs rounded-[9px]",
        lg:      "h-12 px-6 text-[15.5px] rounded-[13px]",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
