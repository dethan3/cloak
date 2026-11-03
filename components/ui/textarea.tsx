import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full bg-[var(--sheet)] px-3 py-2 text-base text-[var(--ink)] ring-1 ring-[var(--line)] outline-none placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
