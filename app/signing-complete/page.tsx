import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signing complete",
};

export default function SigningCompletePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="font-serif text-2xl text-ink">Signing complete</h1>
        <p className="text-sm leading-6 text-ink-muted">
          Your document has been signed successfully. You may close this window.
        </p>
      </div>
    </main>
  );
}
