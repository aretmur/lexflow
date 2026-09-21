"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelSignatureRequestAction,
  resendSignatureRequestAction,
  retrySignedDocumentAction,
  sendForSignatureAction,
} from "@/app/actions/signatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import {
  formatDocumentDate,
  formatDocumentDateTime,
} from "@/lib/documents/formatters";
import type { FormActionState } from "@/lib/validations";

export type SignaturePanelRequest = {
  signerName: string;
  signerEmail: string;
  status: string;
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

const initialState: FormActionState = {};

export function SignaturePanel({
  agreementId,
  agreementStatus,
  defaultSignerName,
  defaultSignerEmail,
  testMode,
  request,
  signedDocument,
}: {
  agreementId: string;
  agreementStatus: string;
  defaultSignerName: string;
  defaultSignerEmail: string;
  testMode: boolean;
  request: SignaturePanelRequest | null;
  signedDocument: SignaturePanelDocument | null;
}) {
  const router = useRouter();
  const [sendState, sendAction, sending] = useActionState(
    sendForSignatureAction,
    initialState,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showTestBanner = testMode || request?.testMode;

  async function run(
    action: (id: string) => Promise<FormActionState>,
  ) {
    setPending(true);
    setActionError(null);
    const result = await action(agreementId);
    setPending(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  const error = sendState.error || actionError;
  const generated = agreementStatus === "generated";
  const awaiting = ["sent", "viewed"].includes(agreementStatus) && request;
  const signed = agreementStatus === "signed" && signedDocument;
  const needsRetry =
    Boolean(request?.lastError) &&
    !signedDocument &&
    (request?.status === "signed" || Boolean(request?.signedAt));

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl">Signature</h2>
      {showTestBanner ? (
        <Notice tone="warning">TEST SIGNATURE REQUEST</Notice>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {generated ? (
        <form action={sendAction} className="space-y-4">
          <input type="hidden" name="agreementId" value={agreementId} />
          <p className="text-sm text-ink-muted">
            Confirm the client name and email. Dropbox Sign will email a secure
            signing link. The client does not need a Lexflow account.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signerName">Client name</Label>
              <Input
                id="signerName"
                name="signerName"
                defaultValue={defaultSignerName}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signerEmail">Client email</Label>
              <Input
                id="signerEmail"
                name="signerEmail"
                type="email"
                defaultValue={defaultSignerEmail}
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send for signature"}
          </Button>
        </form>
      ) : null}

      {awaiting ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">Signature status: Awaiting signature</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Client</dt>
              <dd>{request.signerName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd>{request.signerEmail}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Sent</dt>
              <dd>{request.sentAt ? formatDocumentDate(request.sentAt) : "—"}</dd>
            </div>
            {request.viewedAt ? (
              <div>
                <dt className="text-ink-muted">Viewed</dt>
                <dd>{formatDocumentDateTime(request.viewedAt)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/agreements/${agreementId}/pack`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center border border-rule-strong bg-paper-raised px-4 text-sm font-medium hover:border-ink"
            >
              View original
            </a>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => run(resendSignatureRequestAction)}
            >
              Resend signing request
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={() => run(cancelSignatureRequestAction)}
            >
              Cancel request
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
            onClick={() => run(retrySignedDocumentAction)}
          >
            Retry signed document
          </Button>
        </div>
      ) : null}

      {signed ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">SIGNED ✓</p>
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
            <a
              href={`/agreements/${agreementId}/pack`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center border border-rule-strong bg-paper-raised px-4 text-sm font-medium hover:border-ink"
            >
              View original generated agreement
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
