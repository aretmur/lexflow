import type { Metadata } from "next";
import { getDropboxSignConfig } from "@/lib/signatures/config";
import { resolveNativeSigningSession } from "@/lib/signatures/native-workflow";
import { getSignatureProvider } from "@/lib/signatures/provider";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import { resolvePublicSigningSession } from "@/lib/signatures/workflow";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NativeSigningRoom } from "@/app/sign/[token]/native-signing-room";
import { SigningEmbed } from "@/app/sign/[token]/signing-embed";

export const metadata: Metadata = {
  title: "Review and sign",
};

export const dynamic = "force-dynamic";

export default async function PublicSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let native;
  try {
    native = await resolveNativeSigningSession({
      store: createSupabaseSignatureStore(createAdminSupabaseClient()),
      token,
    });
  } catch {
    native = { status: "unavailable" as const };
  }

  return (
    <main className="min-h-screen bg-paper px-6 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col">
        <header className="mb-8 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Lexflow
          </p>
          <h1 className="font-serif text-3xl">Review and sign your costs agreement</h1>
        </header>
        {native.status === "needs_otp" || native.status === "ready" ? (
          <>
            {native.testMode ? (
              <div className="mb-6 border border-rule bg-paper-raised px-4 py-3 text-sm">
                TEST SIGNATURE SESSION
              </div>
            ) : null}
            <NativeSigningRoom token={token} session={native} />
          </>
        ) : native.status !== "invalid" ? (
          <SigningMessage status={native.status} />
        ) : (
          <DropboxSigningSession token={token} />
        )}
      </div>
    </main>
  );
}

async function DropboxSigningSession({ token }: { token: string }) {
  let session;
  try {
    session = await resolvePublicSigningSession({
      store: createSupabaseSignatureStore(createAdminSupabaseClient()),
      provider: getSignatureProvider("dropbox_sign"),
      token,
      clientId: getDropboxSignConfig().clientId,
    });
  } catch {
    session = { status: "unavailable" as const };
  }

  if (session.status === "ready" && session.testMode) {
    return (
      <>
        <div className="mb-6 border border-rule bg-paper-raised px-4 py-3 text-sm">
          TEST SIGNATURE SESSION
        </div>
        <SigningEmbed
          signUrl={session.signUrl}
          clientId={session.clientId}
          testMode={session.testMode}
        />
      </>
    );
  }

  if (session.status === "ready") {
    return (
      <SigningEmbed
        signUrl={session.signUrl}
        clientId={session.clientId}
        testMode={session.testMode}
      />
    );
  }

  return <SigningMessage status={session.status} />;
}

function SigningMessage({
  status,
}: {
  status: "invalid" | "expired" | "unavailable" | "completed";
}) {
  if (status === "completed") {
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

  if (status === "expired") {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16 text-center">
        <h2 className="font-serif text-2xl">Signing session expired</h2>
        <p className="text-sm leading-6 text-ink-muted">
          Ask your lawyer to reopen the signing session.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h2 className="font-serif text-2xl">Signing session unavailable</h2>
      <p className="text-sm leading-6 text-ink-muted">
        Ask your lawyer to reopen the signing session.
      </p>
    </div>
  );
}
