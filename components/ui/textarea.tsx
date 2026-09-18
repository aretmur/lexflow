import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full border border-rule bg-paper-raised px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/70 focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
