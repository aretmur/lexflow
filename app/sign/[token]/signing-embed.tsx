"use client";

import { useEffect, useRef, useState } from "react";

export function SigningEmbed({
  signUrl,
  clientId,
  testMode,
}: {
  signUrl: string;
  clientId: string;
  testMode: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let client: {
      open: (url: string, options?: Record<string, unknown>) => void;
      close: () => void;
      on: (event: string, handler: () => void) => void;
    } | null = null;

    async function open() {
      const HelloSign = (await import("hellosign-embedded")).default;
      if (cancelled || !containerRef.current) {
        return;
      }
      client = new HelloSign({
        clientId,
        skipDomainVerification: testMode,
      });
      client.on("sign", () => {
        if (!cancelled) {
          setComplete(true);
        }
      });
      client.on("error", () => {
        if (!cancelled) {
          setError("The signing session could not be opened. Ask your lawyer to reopen it.");
        }
      });
      client.open(signUrl, {
        allowCancel: false,
        skipDomainVerification: testMode,
        container: containerRef.current,
      });
    }

    open().catch(() => {
      if (!cancelled) {
        setError("The signing session could not be opened. Ask your lawyer to reopen it.");
      }
    });

    return () => {
      cancelled = true;
      client?.close();
    };
  }, [clientId, signUrl, testMode]);

  if (complete) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16 text-center">
        <h2 className="font-serif text-2xl">SIGNED SUCCESSFULLY</h2>
        <p className="text-sm leading-6 text-ink-muted">
          Your signed agreement has been received.
        </p>
        <p className="text-sm leading-6 text-ink-muted">You may close this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div ref={containerRef} className="min-h-[70vh] w-full bg-paper-raised" />
    </div>
  );
}
