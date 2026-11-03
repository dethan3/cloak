import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full bg-[var(--sheet)] px-3 text-base text-[var(--ink)] ring-1 ring-[var(--line)] outline-none placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
