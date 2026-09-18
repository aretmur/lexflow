"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Something went wrong</h1>
      <p className="max-w-xl text-sm leading-6 text-ink-muted">
        {error.message || "The page could not be loaded."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-sm underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
