import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full border border-rule bg-paper-raised px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/70 focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
