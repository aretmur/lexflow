import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full border border-rule bg-paper-raised px-3 text-sm text-ink outline-none focus:border-accent",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
