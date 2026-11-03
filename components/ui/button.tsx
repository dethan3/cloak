import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--stamp)] text-[var(--reverse)] hover:bg-[var(--stamp-bright)]",
        secondary:
          "bg-[var(--sheet)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--paper)]",
        ghost: "bg-transparent text-[var(--ink)] hover:bg-[var(--sheet)]",
        destructive: "bg-[var(--danger)] text-[var(--danger-ink)] hover:opacity-90",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
