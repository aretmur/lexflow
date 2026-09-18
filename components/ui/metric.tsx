import { cn } from "@/lib/cn";

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className={cn("mt-1 text-xs text-ink-muted")}>{hint}</p>
      ) : null}
    </div>
  );
}
