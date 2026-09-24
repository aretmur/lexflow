import { randomUUID } from "node:crypto";
import { emailsMatch, getMicrosoftGraphSender } from "@/lib/email/config";
import {
  EMAIL_SEND_FAILED,
  EMAIL_SENDER_NOT_AUTHORISED,
  FIRM_SIGNED_COPY_EMAIL_MISSING,
  SIGNED_PDF_TOO_LARGE,
  EmailProviderError,
  getEmailProvider,
} from "@/lib/email/provider";
import { firmSignedCopyRecipient } from "@/lib/email/identity";
import {
  SIGNED_AGREEMENT_ATTACHMENT_NAME,
  signedClientCopyEmail,
  signedFirmCopyEmail,
} from "@/lib/email/templates";
import { formatDocumentDateTime } from "@/lib/documents/formatters";
import type { SignatureStore } from "@/lib/signatures/store";
import type {
  SignatureRequestRecord,
  SignedAgreementDocumentRecord,
  SignedDocumentRecipientRole,
} from "@/lib/signatures/types";
import { SignatureWorkflowError } from "@/lib/signatures/types";

export const GRAPH_DIRECT_ATTACHMENT_MAX_BYTES = Math.floor(2.5 * 1024 * 1024);

export function canAttachSignedPdf(byteLength: number) {
  return byteLength > 0 && byteLength <= GRAPH_DIRECT_ATTACHMENT_MAX_BYTES;
}

export function signingMethodLabel(mode: string) {
  if (mode === "qr" || mode === "embedded_qr") {
    return "QR";
  }
  if (mode === "same_device" || mode === "embedded_same_device") {
    return "This device";
  }
  return "Email";
}

function pdfAttachment(bytes: Uint8Array) {
  return {
    filename: SIGNED_AGREEMENT_ATTACHMENT_NAME,
    contentType: "application/pdf",
    bytes,
  };
}

function safeDeliveryError(error: unknown) {
  if (error instanceof EmailProviderError) {
    return error.message;
  }
  return EMAIL_SEND_FAILED;
}

export async function deliverSignedAgreementCopies(input: {
  store: SignatureStore;
  request: SignatureRequestRecord;
  signed: SignedAgreementDocumentRecord;
  pdfBytes: Uint8Array;
  now?: Date;
  retryRole?: SignedDocumentRecipientRole;
}) {
  const identity = await input.store.loadFirmSigningContact(input.request.firmId);
  const firmName = identity?.displayName || input.request.firmDisplayName || "Lexflow";
  const firmRecipient = firmSignedCopyRecipient({
    signing_reply_to_email: identity?.replyTo,
    signing_sender_email: identity?.senderEmail,
  });
  const emailFrom = identity?.senderEmail || getMicrosoftGraphSender() || undefined;

  const jobs: Array<{
    role: SignedDocumentRecipientRole;
    email: string | null;
    missingError?: string;
  }> = [
    { role: "client", email: input.request.signerEmail },
    {
      role: "firm",
      email: firmRecipient,
      missingError: FIRM_SIGNED_COPY_EMAIL_MISSING,
    },
  ];

  for (const job of jobs) {
    if (input.retryRole && job.role !== input.retryRole) {
      continue;
    }
    await deliverOne({
      store: input.store,
      request: input.request,
      signed: input.signed,
      pdfBytes: input.pdfBytes,
      role: job.role,
      email: job.email,
      missingError: job.missingError,
      firmName,
      emailFrom,
      replyTo: identity?.replyTo,
      retry: Boolean(input.retryRole),
      now: input.now,
    });
  }
}

async function deliverOne(input: {
  store: SignatureStore;
  request: SignatureRequestRecord;
  signed: SignedAgreementDocumentRecord;
  pdfBytes: Uint8Array;
  role: SignedDocumentRecipientRole;
  email: string | null;
  missingError?: string;
  firmName: string;
  emailFrom?: string;
  replyTo?: string | null;
  retry: boolean;
  now?: Date;
}) {
  const existing = await input.store.loadDelivery(input.signed.id, input.role);
  if (existing?.status === "sent") {
    return existing;
  }
  if (existing?.status === "failed" && !input.retry) {
    return existing;
  }

  const record = await input.store.upsertDelivery({
    id: existing?.id ?? randomUUID(),
    firmId: input.request.firmId,
    signedDocumentId: input.signed.id,
    signatureRequestId: input.request.id,
    recipientRole: input.role,
    recipientEmail: input.email?.trim() || existing?.recipientEmail || "missing@invalid",
    status: "pending",
    attemptCount: (existing?.attemptCount ?? 0) + 1,
    lastError: null,
    sentAt: null,
    provider: null,
    providerMessageId: null,
  });

  if (!input.email?.trim()) {
    return input.store.upsertDelivery({
      ...record,
      status: "failed",
      lastError: input.missingError || EMAIL_SEND_FAILED,
    });
  }

  if (!canAttachSignedPdf(input.pdfBytes.byteLength)) {
    return input.store.upsertDelivery({
      ...record,
      recipientEmail: input.email.trim(),
      status: "failed",
      lastError: SIGNED_PDF_TOO_LARGE,
    });
  }

  try {
    const provider = getEmailProvider();
    if (provider.name === "microsoft_graph") {
      if (!emailsMatch(input.emailFrom, getMicrosoftGraphSender())) {
        throw new EmailProviderError(EMAIL_SENDER_NOT_AUTHORISED);
      }
    }
    const message =
      input.role === "client"
        ? signedClientCopyEmail({
            clientName: input.request.signerName,
            firmName: input.firmName,
          })
        : signedFirmCopyEmail({
            clientName: input.request.signerName,
            signedAt: formatDocumentDateTime(input.signed.signedAt),
            signingMethod: signingMethodLabel(input.request.signingMode),
          });
    const result = await provider.send({
      to: input.email.trim(),
      subject: message.subject,
      text: message.text,
      from: input.emailFrom,
      replyTo: input.replyTo || undefined,
      attachments: [pdfAttachment(input.pdfBytes)],
    });
    return input.store.upsertDelivery({
      ...record,
      recipientEmail: input.email.trim(),
      status: "sent",
      lastError: null,
      sentAt: (input.now ?? new Date()).toISOString(),
      provider: result.provider,
      providerMessageId: result.messageId,
    });
  } catch (error) {
    return input.store.upsertDelivery({
      ...record,
      recipientEmail: input.email.trim(),
      status: "failed",
      lastError: safeDeliveryError(error),
    });
  }
}

export function deliveryStatusLabel(row: { status: string } | null) {
  if (!row) {
    return "Pending";
  }
  if (row.status === "sent") {
    return "Sent";
  }
  if (row.status === "failed") {
    return "Failed";
  }
  return "Pending";
}

export async function retrySignedDocumentDelivery(input: {
  store: SignatureStore;
  firmId: string;
  agreementId: string;
  recipientRole: SignedDocumentRecipientRole;
  actorUserId: string;
  now?: Date;
}) {
  const signed = await input.store.loadSignedDocument(input.firmId, input.agreementId);
  if (!signed) {
    throw new SignatureWorkflowError("The signed agreement could not be found.");
  }
  const request = await input.store.loadRequestById(input.firmId, signed.signatureRequestId);
  if (!request) {
    throw new SignatureWorkflowError("The signature request could not be found.");
  }
  const existing = await input.store.loadDelivery(signed.id, input.recipientRole);
  if (!existing || existing.status !== "failed") {
    throw new SignatureWorkflowError("This signed copy does not need to be resent.");
  }
  const pdfBytes = await input.store.downloadSignedPdf(signed.storagePath);
  if (!pdfBytes) {
    throw new SignatureWorkflowError("The signed agreement could not be retrieved.");
  }
  await deliverSignedAgreementCopies({
    store: input.store,
    request,
    signed,
    pdfBytes,
    now: input.now,
    retryRole: input.recipientRole,
  });
  await input.store.insertAudit({
    firmId: input.firmId,
    actorUserId: input.actorUserId,
    entityType: "signed_agreement_document",
    entityId: signed.id,
    action: "signed_copy_email_retried",
    payload: { recipientRole: input.recipientRole },
  });
}
