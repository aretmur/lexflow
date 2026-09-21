"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelSignatureRequestAction,
  refreshSigningSessionAction,
  resendSignatureRequestAction,
  retrySignedDocumentAction,
  startSigningAction,
} from "@/app/actions/signatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { Notice } from "@/components/ui/notice";
import { formatDocumentDateTime } from "@/lib/documents/formatters";
import type { SigningMode } from "@/lib/types/enums";
import type { SigningActionState } from "@/lib/validations";

export type SignaturePanelRequest = {
  signerName: string;
  signerEmail: string;
  status: string;
  signingMode: SigningMode;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  lastError: string | null;
  testMode: boolean;
};

export type SignaturePanelDocument = {
  signedAt: string;
  sha256: string;
};

export function SignaturePanel({
  agreementId,
  agreementStatus,
  defaultSignerName,
  defaultSignerEmail,
  testMode,
  request,
  signedDocument,
  defaultRequirePageInitials,
}: {
  agreementId: string;
  agreementStatus: string;
  defaultSignerName: string;
  defaultSignerEmail: string;
  testMode: boolean;
  request: SignaturePanelRequest | null;
  signedDocument: SignaturePanelDocument | null;
  defaultRequirePageInitials: boolean;
}) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requirePageInitials, setRequirePageInitials] = useState(
    defaultRequirePageInitials,
  );
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const showTestBanner = testMode || request?.testMode;

  useEffect(() => {
    if (!["sent", "viewed"].includes(agreementStatus) || signedDocument) {
      return;
    }
    const timer = window.setInterval(() => {
      router.refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [agreementStatus, router, signedDocument]);

  async function run(action: () => Promise<SigningActionState>, next?: (state: SigningActionState) => void) {
    setPending(true);
    setActionError(null);
    setCopied(false);
    const result = await action();
    setPending(false);
    if (result.error) {
      setActionError(result.error);
      return result;
    }
    if (result.signingUrl) {
      setSigningUrl(result.signingUrl);
    }
    if (result.qrDataUrl) {
      setQrDataUrl(result.qrDataUrl);
    }
    next?.(result);
    router.refresh();
    return result;
  }

  function formData(mode: SigningMode) {
    const data = new FormData();
    data.set("agreementId", agreementId);
    data.set("signerName", signerName);
    data.set("signerEmail", signerEmail);
    data.set("requirePageInitials", requirePageInitials ? "true" : "false");
    data.set("signingMode", mode);
    return data;
  }

  async function start(mode: SigningMode) {
    const result = await run(() => startSigningAction(formData(mode)));
    if (mode === "embedded_same_device" && result.signingUrl) {
      window.location.assign(result.signingUrl);
    }
  }

  async function copyLink(url = signingUrl) {
    if (!url) {
      const result = await run(() => refreshSigningSessionAction(agreementId));
      url = result.signingUrl ?? null;
    }
    if (!url) {
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  const generated = agreementStatus === "generated";
  const awaiting = ["sent", "viewed"].includes(agreementStatus) && request;
  const signed = agreementStatus === "signed" && signedDocument;
  const needsRetry =
    Boolean(request?.lastError) &&
    !signedDocument &&
    (request?.status === "signed" || Boolean(request?.signedAt));
  const embedded =
    request?.signingMode === "embedded_qr" ||
    request?.signingMode === "embedded_same_device";
  const statusLabel = signingStatusLabel(request, Boolean(signedDocument));

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl">
        {signed ? "SIGNED ✓" : awaiting ? "Awaiting signature" : "READY TO SIGN"}
      </h2>
      {showTestBanner ? (
        <Notice tone="warning">
          {awaiting || signed ? "TEST SIGNATURE SESSION" : "TEST SIGNATURE SESSION"}
        </Notice>
      ) : null}
      {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}

      {generated ? (
        <div className="space-y-5">
          <p className="text-sm text-ink-muted">
            Confirm the client details, then choose how they should sign. The
            client does not need a Lexflow account.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signerName">Client name</Label>
              <Input
                id="signerName"
                name="signerName"
                value={signerName}
                onChange={(event) => setSignerName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signerEmail">Client email</Label>
              <Input
                id="signerEmail"
                name="signerEmail"
                type="email"
                value={signerEmail}
                onChange={(event) => setSignerEmail(event.target.value)}
                required
              />
            </div>
          </div>
          <InitialsToggle
            enabled={requirePageInitials}
            onChange={setRequirePageInitials}
          />
          <div className="space-y-3">
            <p className="text-sm font-medium">How should the client sign?</p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="h-12 px-6 text-base"
                disabled={pending}
                onClick={() => start("embedded_qr")}
              >
                {pending ? "Starting…" : "Show QR code"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => start("email")}
              >
                Email signing link
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => start("embedded_same_device")}
              >
                Sign on this device
              </Button>
              <a
                href={`/agreements/${agreementId}/pack`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center px-4 text-sm font-medium text-ink-muted hover:text-ink"
              >
                View PDF
              </a>
              <a
                href={`/agreements/${agreementId}/pack?download=1`}
                className="inline-flex h-10 items-center px-4 text-sm font-medium text-ink-muted hover:text-ink"
              >
                Download PDF
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {awaiting ? (
        <div className="space-y-4">
          {request.signingMode !== "email" ? (
            <p className="text-sm font-medium">Signing in progress…</p>
          ) : null}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Method</dt>
              <dd>{methodLabel(request.signingMode)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Client</dt>
              <dd>{request.signerName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">
                {request.signingMode === "email" ? "Sent" : "Started"}
              </dt>
              <dd>{request.sentAt ? formatDocumentDateTime(request.sentAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Status</dt>
              <dd>{statusLabel}</dd>
            </div>
          </dl>
          {embedded && qrDataUrl ? (
            <div className="space-y-3 border border-rule bg-paper-raised px-4 py-5">
              <p className="text-sm font-medium">SCAN TO SIGN</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code for the client to sign"
                className="h-64 w-64 bg-paper-raised"
              />
              <p className="text-sm text-ink-muted">
                The client reviews the agreement, initials every required page,
                then signs. They do not need a Lexflow account.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {embedded ? (
              <>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => refreshSigningSessionAction(agreementId))}
                >
                  Show QR again
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => copyLink()}
                >
                  {copied ? "Link copied" : "Copy signing link"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={async () => {
                    const result = signingUrl
                      ? { signingUrl }
                      : await run(() => refreshSigningSessionAction(agreementId));
                    if (result.signingUrl) {
                      window.location.assign(result.signingUrl);
                    }
                  }}
                >
                  Sign on this device
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => resendSignatureRequestAction(agreementId))}
              >
                Resend email
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={() => run(() => cancelSignatureRequestAction(agreementId))}
            >
              Cancel signing request
            </Button>
          </div>
        </div>
      ) : null}

      {needsRetry ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            The provider reported completion, but the signed PDF has not been stored
            yet.
          </p>
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => retrySignedDocumentAction(agreementId))}
          >
            Retry signed document
          </Button>
        </div>
      ) : null}

      {signed ? (
        <div className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Signed by</dt>
              <dd>{request?.signerName ?? defaultSignerName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Signed</dt>
              <dd>{formatDocumentDateTime(signedDocument.signedAt)}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/agreements/${agreementId}/signed`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center bg-accent px-4 text-sm font-medium text-paper-raised hover:bg-accent-hover"
            >
              View signed agreement
            </a>
            <a
              href={`/agreements/${agreementId}/signed?download=1`}
              className="inline-flex h-10 items-center border border-rule-strong bg-paper-raised px-4 text-sm font-medium hover:border-ink"
            >
              Download signed agreement
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InitialsToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Require client initials on every page</Label>
      <p className="text-sm text-ink-muted">
        When enabled, the client must initial every page of the agreement pack
        before completing the signature request.
      </p>
      <div className="inline-flex border border-rule-strong">
        {(
          [
            { value: true, label: "ON" },
            { value: false, label: "OFF" },
          ] as const
        ).map((option) => {
          const selected = enabled === option.value;
          return (
            <button
              key={option.label}
              type="button"
              className={cn(
                "h-10 px-4 text-sm font-medium",
                selected
                  ? "bg-accent text-paper-raised"
                  : "bg-paper-raised text-ink hover:border-ink",
              )}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function methodLabel(mode: SigningMode) {
  if (mode === "embedded_qr") {
    return "QR";
  }
  if (mode === "embedded_same_device") {
    return "This device";
  }
  return "Email";
}

function signingStatusLabel(
  request: SignaturePanelRequest | null,
  hasSignedDocument: boolean,
) {
  if (!request) {
    return "Not opened";
  }
  if (hasSignedDocument || request.status === "signed") {
    return "Signed";
  }
  if (request.signedAt) {
    return "Signing";
  }
  if (request.viewedAt || request.status === "viewed") {
    return "Viewed";
  }
  return "Not opened";
}
