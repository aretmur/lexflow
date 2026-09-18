import { cn } from "@/lib/cn";

export function Notice({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <p
      className={cn(
        "border px-4 py-3 text-sm leading-6",
        tone === "warning"
          ? "border-warning/30 bg-warning-wash text-warning"
          : "border-rule bg-paper-raised text-ink-muted",
      )}
    >
      {children}
    </p>
  );
}
