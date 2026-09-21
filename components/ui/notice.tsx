import { cn } from "@/lib/cn";

export function Notice({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      className={cn(
        "space-y-2 border px-4 py-3 text-sm leading-6",
        tone === "warning"
          ? "border-warning/30 bg-warning-wash text-warning"
          : "border-rule bg-paper-raised text-ink-muted",
      )}
    >
      {children}
    </div>
  );
}
