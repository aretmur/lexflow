import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "danger" | "accent";
}) {
  const tones = {
    neutral: "border-rule text-ink-muted",
    warning: "border-warning/30 bg-warning-wash text-warning",
    danger: "border-danger/20 text-danger",
    accent: "border-accent/20 text-accent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
