import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
