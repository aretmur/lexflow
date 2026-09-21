import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { signedAgreementStoragePath } from "@/lib/documents/pdf/storage-path";
import { logServerError, publicActionError } from "@/lib/server-log";
import {
  formFieldsPerDocument,
  pageGeometriesFromPdf,
} from "@/lib/signatures/form-fields";
import {
  createSigningToken,
  hashSigningToken,
  isSigningTokenExpired,
  publicSigningUrl,
  signingTokenExpiresAt,
} from "@/lib/signatures/signing-token";
import {
  SIGNING_EMAIL_SUBJECT,
  signingRedirectUrl,
} from "@/lib/signatures/text-tags";
import { getSignatureProvider } from "@/lib/signatures/provider";
import type { SignatureStore } from "@/lib/signatures/store";
import {
  SignatureProviderError,
  SignatureWorkflowError,
  type ProviderWebhookEvent,
  type SignatureProvider,
  type SignatureRequestRecord,
  type SignatureSigner,
  type SigningMode,
  type SignedAgreementDocumentRecord,
} from "@/lib/signatures/types";

const signerSchema = z.object({
  name: z.string().trim().min(1, "Client name is required.").max(200),
  email: z.email("Enter a valid client email address."),
});

export type SendSignatureResult = {
  request: SignatureRequestRecord;
};

export type EmbeddedSigningResult = {
  request: SignatureRequestRecord;
  signingUrl: string;
  token: string;
};

export type PublicSigningSession =
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "unavailable" }
  | { status: "completed"; signerName: string }
  | {
      status: "ready";
      signUrl: string;
      signUrlExpiresAt: string;
      clientId: string;
      testMode: boolean;
      signerName: string;
    };

export async function sendForSignature(input: {
  store: SignatureStore;
  provider: SignatureProvider;
  firmId: string;
  agreementId: string;
  actorUserId: string;
  signer: SignatureSigner;
  testMode: boolean;
  requirePageInitials?: boolean;
  replaceActive?: boolean;
  now?: Date;
}): Promise<SendSignatureResult> {
  const signer = parseSigner(input.signer);
  const context = await prepareSendContext(input, "email");
  if (context.activeRequest?.signingMode === "email") {
    throw new SignatureWorkflowError(
      "A signature request is already outstanding for this agreement.",
    );
  }

  const packBytes = await input.store.downloadGeneratedPack(context.packStoragePath);
  if (!packBytes) {
    throw new SignatureWorkflowError("The generated agreement pack could not be retrieved.");
  }

  const requirePageInitials = input.requirePageInitials !== false;
  const pages = await pageGeometriesFromPdf(packBytes);
  const pageCount = pages.length;
  const formFields = formFieldsPerDocument(pages, requirePageInitials);
  const initialsFieldCount = formFields?.[0]?.length ?? 0;

  let providerRequestId: string;
  try {
    const created = await input.provider.createSignatureRequest({
      title: "Costs agreement",
      subject: SIGNING_EMAIL_SUBJECT,
      fileName: `agreement-pack-v${context.packVersionNumber}.pdf`,
      fileBytes: packBytes,
      signer,
      metadata: {
        lexflow_firm_id: context.firmId,
        lexflow_agreement_id: context.agreementId,
        lexflow_agreement_version_id: context.versionId,
        lexflow_generated_pack_id: context.packId,
      },
      signingRedirectUrl: signingRedirectUrl(),
      testMode: input.testMode,
      formFieldsPerDocument: formFields,
    });
    providerRequestId = created.providerRequestId;
  } catch (error) {
    logServerError("signature_request_create_failed", {
      agreementId: input.agreementId,
      firmId: input.firmId,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw new SignatureWorkflowError(
      publicActionError(
        error instanceof Error ? error.message : undefined,
        "Unable to send the agreement for signature.",
      ),
    );
  }

  const sentAt = (input.now ?? new Date()).toISOString();
  let request: SignatureRequestRecord;
  try {
    request = await input.store.insertRequest({
      firmId: context.firmId,
      costsAgreementId: context.agreementId,
      agreementVersionId: context.versionId,
      generatedPackId: context.packId,
      provider: input.provider.name,
      providerRequestId,
      signerName: signer.name,
      signerEmail: signer.email,
      status: "sent",
      testMode: input.testMode,
      sentAt,
      createdBy: input.actorUserId,
      requirePageInitials,
      initialsFieldCount,
      pageCount,
      signingMode: "email",
    });
    await input.store.updateAgreementStatus(context.firmId, context.agreementId, "sent", [
      "generated",
    ]);
  } catch (error) {
    await input.provider.cancelSignatureRequest(providerRequestId).catch((cancelError) => {
      logServerError("signature_request_orphan_cancel_failed", {
        providerRequestId,
        message: cancelError instanceof Error ? cancelError.message : "unknown",
      });
    });
    throw error;
  }

  await input.store.insertAudit({
    firmId: context.firmId,
    actorUserId: input.actorUserId,
    entityType: "costs_agreement",
    entityId: context.agreementId,
    action: "signature_request_sent",
    payload: {
      signatureRequestId: request.id,
      providerRequestId,
      provider: input.provider.name,
      agreementVersionId: context.versionId,
      signerName: signer.name,
      signerEmail: signer.email,
      sentAt,
      testMode: input.testMode,
      requirePageInitials,
      initialsFieldCount,
      pageCount,
      signingMode: "email",
    },
  });

  return { request };
}

export async function startEmbeddedSigning(input: {
  store: SignatureStore;
  provider: SignatureProvider;
  firmId: string;
  agreementId: string;
  actorUserId: string;
  signer: SignatureSigner;
  testMode: boolean;
  signingMode: Extract<SigningMode, "embedded_qr" | "embedded_same_device">;
  requirePageInitials?: boolean;
  replaceActive?: boolean;
  now?: Date;
}): Promise<EmbeddedSigningResult> {
  const signer = parseSigner(input.signer);
  const context = await prepareSendContext(input, input.signingMode);
  if (
    context.activeRequest &&
    (context.activeRequest.signingMode === "embedded_qr" ||
      context.activeRequest.signingMode === "embedded_same_device")
  ) {
    return rotateSigningToken({
      store: input.store,
      request: context.activeRequest,
      actorUserId: input.actorUserId,
      now: input.now,
    });
  }

  const pack = await loadPackFields(input.store, context, input.requirePageInitials);

  let created: { providerRequestId: string; providerSignatureId: string };
  try {
    created = await input.provider.createEmbeddedSignatureRequest({
      title: "Costs agreement",
      subject: SIGNING_EMAIL_SUBJECT,
      fileName: `agreement-pack-v${context.packVersionNumber}.pdf`,
      fileBytes: pack.packBytes,
      signer,
      metadata: {
        lexflow_firm_id: context.firmId,
        lexflow_agreement_id: context.agreementId,
        lexflow_agreement_version_id: context.versionId,
        lexflow_generated_pack_id: context.packId,
      },
      signingRedirectUrl: signingRedirectUrl(),
      testMode: input.testMode,
      formFieldsPerDocument: pack.formFields,
    });
  } catch (error) {
    logServerError("embedded_signature_request_create_failed", {
      agreementId: input.agreementId,
      firmId: input.firmId,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw new SignatureWorkflowError(
      publicActionError(
        error instanceof Error ? error.message : undefined,
        "Unable to start the signing session.",
      ),
    );
  }

  const issued = issueSigningToken(input.now);
  const sentAt = (input.now ?? new Date()).toISOString();
  let request: SignatureRequestRecord;
  try {
    request = await input.store.insertRequest({
      firmId: context.firmId,
      costsAgreementId: context.agreementId,
      agreementVersionId: context.versionId,
      generatedPackId: context.packId,
      provider: input.provider.name,
      providerRequestId: created.providerRequestId,
      signerName: signer.name,
      signerEmail: signer.email,
      status: "sent",
      testMode: input.testMode,
      sentAt,
      createdBy: input.actorUserId,
      requirePageInitials: pack.requirePageInitials,
      initialsFieldCount: pack.initialsFieldCount,
      pageCount: pack.pageCount,
      signingMode: input.signingMode,
      providerSignatureId: created.providerSignatureId,
      signingTokenHash: issued.hash,
      signingTokenExpiresAt: issued.expiresAt,
    });
    await input.store.updateAgreementStatus(context.firmId, context.agreementId, "sent", [
      "generated",
    ]);
  } catch (error) {
    await input.provider.cancelSignatureRequest(created.providerRequestId).catch((cancelError) => {
      logServerError("signature_request_orphan_cancel_failed", {
        providerRequestId: created.providerRequestId,
        message: cancelError instanceof Error ? cancelError.message : "unknown",
      });
    });
    throw error;
  }

  await input.store.insertAudit({
    firmId: context.firmId,
    actorUserId: input.actorUserId,
    entityType: "costs_agreement",
    entityId: context.agreementId,
    action: "signature_request_sent",
    payload: {
      signatureRequestId: request.id,
      providerRequestId: created.providerRequestId,
      providerSignatureId: created.providerSignatureId,
      provider: input.provider.name,
      agreementVersionId: context.versionId,
      signerName: signer.name,
      signerEmail: signer.email,
      sentAt,
      testMode: input.testMode,
      requirePageInitials: pack.requirePageInitials,
      initialsFieldCount: pack.initialsFieldCount,
      pageCount: pack.pageCount,
      signingMode: input.signingMode,
    },
  });

  return {
    request,
    token: issued.token,
    signingUrl: publicSigningUrl(issued.token),
  };
}

export async function refreshEmbeddedSigningSession(input: {
  store: SignatureStore;
  firmId: string;
  agreementId: string;
  actorUserId: string;
  now?: Date;
}): Promise<EmbeddedSigningResult> {
  const context = await input.store.loadSendContext(input.firmId, input.agreementId);
  const request = context?.activeRequest;
  if (!context || context.firmId !== input.firmId || !request) {
    throw new SignatureWorkflowError("There is no outstanding signing session.");
  }
  if (request.signingMode === "email") {
    throw new SignatureWorkflowError("This signature request was sent by email.");
  }
  return rotateSigningToken({
    store: input.store,
    request,
    actorUserId: input.actorUserId,
    now: input.now,
  });
}

export async function resolvePublicSigningSession(input: {
  store: SignatureStore;
  provider: SignatureProvider;
  token: string;
  clientId?: string;
  now?: Date;
}): Promise<PublicSigningSession> {
  const token = input.token.trim();
  if (!token) {
    return { status: "invalid" };
  }

  const request = await input.store.loadRequestByTokenHash(hashSigningToken(token));
  if (!request) {
    return { status: "invalid" };
  }
  if (["signed"].includes(request.status) || request.signedAt) {
    return { status: "completed", signerName: request.signerName };
  }
  if (["cancelled", "declined", "expired", "failed"].includes(request.status)) {
    return { status: "unavailable" };
  }
  if (isSigningTokenExpired(request.signingTokenExpiresAt, input.now)) {
    return { status: "expired" };
  }
  if (!request.providerSignatureId) {
    return { status: "unavailable" };
  }

  const clientId = input.clientId?.trim();
  if (!clientId) {
    throw new SignatureWorkflowError("Embedded signing is not configured.");
  }

  let embedded: { signUrl: string; expiresAt: string };
  try {
    embedded = await input.provider.getEmbeddedSignUrl(request.providerSignatureId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/already signed|complete|409/i.test(message)) {
      return { status: "completed", signerName: request.signerName };
    }
    throw new SignatureWorkflowError(
      publicActionError(message || undefined, "Unable to open the signing session."),
    );
  }

  if (!request.viewedAt) {
    await input.store.updateRequest(request.id, {
      status: request.status === "signed" ? "signed" : "viewed",
      viewedAt: (input.now ?? new Date()).toISOString(),
    });
    await input.store.updateAgreementStatus(
      request.firmId,
      request.costsAgreementId,
      "viewed",
      ["sent", "viewed"],
    );
  }

  return {
    status: "ready",
    signUrl: embedded.signUrl,
    signUrlExpiresAt: embedded.expiresAt,
    clientId,
    testMode: request.testMode,
    signerName: request.signerName,
  };
}

export async function resendSignatureRequest(input: {
  store: SignatureStore;
  provider: SignatureProvider;
  firmId: string;
  agreementId: string;
  actorUserId: string;
}): Promise<void> {
  const context = await input.store.loadSendContext(input.firmId, input.agreementId);
  const request = context?.activeRequest;
  if (!context || context.firmId !== input.firmId || !request?.providerRequestId) {
    throw new SignatureWorkflowError("There is no outstanding signature request to resend.");
  }
  if (!["sent", "viewed"].includes(request.status)) {
    throw new SignatureWorkflowError("This signature request cannot be resent.");
  }
  if (request.signingMode !== "email") {
    throw new SignatureWorkflowError("Only emailed signing links can be resent.");
  }

  try {
    await input.provider.remindSignatureRequest(
      request.providerRequestId,
      request.signerEmail,
    );
  } catch (error) {
    throw new SignatureWorkflowError(
      publicActionError(
        error instanceof Error ? error.message : undefined,
        "Unable to resend the signing request.",
      ),
    );
  }

  await input.store.insertAudit({
    firmId: request.firmId,
    actorUserId: input.actorUserId,
    entityType: "costs_agreement",
    entityId: request.costsAgreementId,
    action: "signature_request_resent",
    payload: {
      signatureRequestId: request.id,
      providerRequestId: request.providerRequestId,
      signerEmail: request.signerEmail,
    },
  });
}

export async function cancelSignatureRequest(input: {
  store: SignatureStore;
  provider: Pick<SignatureProvider, "name" | "cancelSignatureRequest">;
  firmId: string;
  agreementId: string;
  actorUserId: string;
  now?: Date;
}): Promise<void> {
  const context = await input.store.loadSendContext(input.firmId, input.agreementId);
  const request = context?.activeRequest;
  if (!context || context.firmId !== input.firmId || !request) {
    throw new SignatureWorkflowError("There is no outstanding signature request to cancel.");
  }

  if (request.provider !== "native_lexflow") {
    if (!request.providerRequestId) {
      throw new SignatureWorkflowError("There is no outstanding signature request to cancel.");
    }
    const provider =
      input.provider.name === request.provider
        ? input.provider
        : getSignatureProvider(request.provider);
    try {
      await provider.cancelSignatureRequest(request.providerRequestId);
    } catch (error) {
      throw new SignatureWorkflowError(
        publicActionError(
          error instanceof Error ? error.message : undefined,
          "Unable to cancel the signing request.",
        ),
      );
    }
  }

  const cancelledAt = (input.now ?? new Date()).toISOString();
  await input.store.updateRequest(request.id, {
    status: "cancelled",
    cancelledAt,
    lastError: null,
    signingTokenHash: null,
    signingTokenExpiresAt: null,
    otpHash: null,
    otpExpiresAt: null,
  });
  await input.store.updateAgreementStatus(request.firmId, request.costsAgreementId, "generated", [
    "sent",
    "viewed",
  ]);
  await input.store.insertAudit({
    firmId: request.firmId,
    actorUserId: input.actorUserId,
    entityType: "costs_agreement",
    entityId: request.costsAgreementId,
    action: "signature_request_cancelled",
    payload: {
      signatureRequestId: request.id,
      providerRequestId: request.providerRequestId,
      cancelledAt,
    },
  });
}

export async function handleProviderEvent(input: {
  store: SignatureStore;
  provider: SignatureProvider;
  event: ProviderWebhookEvent;
  now?: Date;
}): Promise<{ duplicate: boolean; ingested?: SignedAgreementDocumentRecord }> {
  if (!input.event.providerRequestId || input.event.eventType === "ignored") {
    return { duplicate: false };
  }

  const request = await input.store.loadRequestByProviderId(input.event.providerRequestId);
  if (!request) {
    logServerError("signature_webhook_unknown_request", {
      providerRequestId: input.event.providerRequestId,
      eventType: input.event.providerEventType,
    });
    return { duplicate: false };
  }

  const claimed = await input.store.claimWebhookEvent({
    firmId: request.firmId,
    signatureRequestId: request.id,
    provider: request.provider,
    providerEventId: input.event.eventId,
    eventType: input.event.providerEventType,
    payload: {
      eventId: input.event.eventId,
      eventType: input.event.providerEventType,
      occurredAt: input.event.occurredAt,
    },
  });
  if (!claimed) {
    if (input.event.eventType === "downloadable") {
      const ingested = await ingestSignedDocument({
        store: input.store,
        provider: input.provider,
        request,
        now: input.now,
      });
      return { duplicate: true, ingested };
    }
    return { duplicate: true };
  }

  const occurredAt = input.event.occurredAt;
  const patch: Parameters<SignatureStore["updateRequest"]>[1] = {
    lastWebhookEventId: input.event.eventId,
  };

  if (input.event.eventType === "sent") {
    patch.status = request.status === "pending" ? "sent" : request.status;
    patch.sentAt = request.sentAt ?? occurredAt;
    await input.store.updateRequest(request.id, patch);
    await input.store.updateAgreementStatus(request.firmId, request.costsAgreementId, "sent", [
      "generated",
      "sent",
    ]);
    return { duplicate: false };
  }

  if (input.event.eventType === "viewed") {
    patch.status = request.status === "signed" ? "signed" : "viewed";
    patch.viewedAt = request.viewedAt ?? occurredAt;
    await input.store.updateRequest(request.id, patch);
    await input.store.updateAgreementStatus(request.firmId, request.costsAgreementId, "viewed", [
      "sent",
      "viewed",
    ]);
    return { duplicate: false };
  }

  if (input.event.eventType === "signed" || input.event.eventType === "completed") {
    patch.status = request.status === "signed" ? "signed" : request.status;
    patch.signedAt = request.signedAt ?? occurredAt;
    if (input.event.eventType === "completed") {
      patch.completedAt = request.completedAt ?? occurredAt;
    }
    await input.store.updateRequest(request.id, patch);
    await input.store.insertAudit({
      firmId: request.firmId,
      actorUserId: null,
      entityType: "costs_agreement",
      entityId: request.costsAgreementId,
      action:
        input.event.eventType === "completed"
          ? "signature_request_completed"
          : "signature_request_signed",
      payload: {
        signatureRequestId: request.id,
        providerRequestId: request.providerRequestId,
        webhookEventId: input.event.eventId,
        occurredAt,
      },
    });
    return { duplicate: false };
  }

  if (input.event.eventType === "downloadable") {
    await input.store.updateRequest(request.id, {
      ...patch,
      signedAt: request.signedAt ?? occurredAt,
      completedAt: request.completedAt ?? occurredAt,
    });
    const ingested = await ingestSignedDocument({
      store: input.store,
      provider: input.provider,
      request: { ...request, signedAt: request.signedAt ?? occurredAt },
      now: input.now,
    });
    return { duplicate: false, ingested };
  }

  if (input.event.eventType === "declined") {
    await input.store.updateRequest(request.id, {
      ...patch,
      status: "declined",
      declinedAt: occurredAt,
    });
    await input.store.updateAgreementStatus(
      request.firmId,
      request.costsAgreementId,
      "declined",
      ["sent", "viewed", "declined"],
    );
    return { duplicate: false };
  }

  if (input.event.eventType === "cancelled") {
    await input.store.updateRequest(request.id, {
      ...patch,
      status: "cancelled",
      cancelledAt: occurredAt,
    });
    await input.store.updateAgreementStatus(
      request.firmId,
      request.costsAgreementId,
      "generated",
      ["sent", "viewed", "cancelled"],
    );
    return { duplicate: false };
  }

  if (input.event.eventType === "expired") {
    await input.store.updateRequest(request.id, {
      ...patch,
      status: "expired",
      expiredAt: occurredAt,
    });
    await input.store.updateAgreementStatus(
      request.firmId,
      request.costsAgreementId,
      "generated",
      ["sent", "viewed"],
    );
    return { duplicate: false };
  }

  if (input.event.eventType === "failed") {
    await input.store.updateRequest(request.id, {
      ...patch,
      status: "failed",
      lastError: "The signature provider reported an invalid or failed request.",
    });
    return { duplicate: false };
  }

  return { duplicate: false };
}

export async function retrySignedDocumentIngest(input: {
  store: SignatureStore;
  provider: SignatureProvider;
  firmId: string;
  agreementId: string;
}): Promise<SignedAgreementDocumentRecord> {
  const request = await input.store.loadLatestRequest(input.firmId, input.agreementId);
  if (!request || request.firmId !== input.firmId || !request.providerRequestId) {
    throw new SignatureWorkflowError("Signature request not found.");
  }
  return ingestSignedDocument({
    store: input.store,
    provider: input.provider,
    request,
  });
}

async function ingestSignedDocument(input: {
  store: SignatureStore;
  provider: SignatureProvider;
  request: SignatureRequestRecord;
  now?: Date;
}): Promise<SignedAgreementDocumentRecord> {
  const existing = await input.store.loadSignedDocumentByRequest(input.request.id);
  if (existing) {
    return existing;
  }
  if (!input.request.providerRequestId) {
    throw new SignatureWorkflowError("Signature request is missing a provider id.");
  }

  const details = await input.provider.getSignatureRequest(input.request.providerRequestId);
  if (details.providerRequestId !== input.request.providerRequestId) {
    throw new SignatureWorkflowError("Signed document does not match this signature request.");
  }
  if (!details.isComplete) {
    throw new SignatureWorkflowError("The signature request is not complete yet.");
  }

  let bytes: Uint8Array;
  try {
    bytes = await input.provider.downloadSignedDocument(input.request.providerRequestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signed PDF download failed.";
    await input.store.updateRequest(input.request.id, {
      status: "signed",
      completedAt: input.request.completedAt ?? (input.now ?? new Date()).toISOString(),
      lastError: message,
    });
    logServerError("signed_document_download_failed", {
      signatureRequestId: input.request.id,
      providerRequestId: input.request.providerRequestId,
      message,
    });
    throw new SignatureProviderError(message);
  }

  const document = await PDFDocument.load(bytes);
  const signedAt =
    input.request.signedAt ?? input.request.completedAt ?? (input.now ?? new Date()).toISOString();
  const versionNumber = await resolveVersionNumber(input.store, input.request);
  const path = signedAgreementStoragePath({
    firmId: input.request.firmId,
    agreementId: input.request.costsAgreementId,
    versionNumber,
  });

  await input.store.uploadSignedPdf(path, bytes);

  let signed: SignedAgreementDocumentRecord;
  try {
    signed = await input.store.insertSignedDocument({
      firmId: input.request.firmId,
      costsAgreementId: input.request.costsAgreementId,
      agreementVersionId: input.request.agreementVersionId,
      signatureRequestId: input.request.id,
      storagePath: path,
      sha256: sha256Hex(bytes),
      pageCount: document.getPageCount(),
      byteSize: bytes.byteLength,
      signedAt,
    });
  } catch (error) {
    const again = await input.store.loadSignedDocumentByRequest(input.request.id);
    if (again) {
      return again;
    }
    throw error;
  }

  await input.store.updateRequest(input.request.id, {
    status: "signed",
    signedAt,
    completedAt: input.request.completedAt ?? signedAt,
    lastError: null,
  });
  await input.store.updateAgreementStatus(
    input.request.firmId,
    input.request.costsAgreementId,
    "signed",
    ["sent", "viewed", "signed"],
  );
  await input.store.markVersionExecuted(
    input.request.firmId,
    input.request.agreementVersionId,
    signedAt,
  );
  await input.store.insertAudit({
    firmId: input.request.firmId,
    actorUserId: null,
    entityType: "costs_agreement",
    entityId: input.request.costsAgreementId,
    action: "agreement_signed",
    payload: {
      signatureRequestId: input.request.id,
      providerRequestId: input.request.providerRequestId,
      agreementVersionId: input.request.agreementVersionId,
      signerName: input.request.signerName,
      signerEmail: input.request.signerEmail,
      signedAt,
      sha256: signed.sha256,
      pageCount: signed.pageCount,
      webhookEventId: input.request.lastWebhookEventId,
    },
  });

  return signed;
}

async function resolveVersionNumber(store: SignatureStore, request: SignatureRequestRecord) {
  const context = await store.loadSendContext(request.firmId, request.costsAgreementId);
  return context?.versionNumber ?? 1;
}

export function parseSigner(signer: SignatureSigner): SignatureSigner {
  const parsed = signerSchema.safeParse(signer);
  if (!parsed.success) {
    throw new SignatureWorkflowError(parsed.error.issues[0]?.message ?? "Invalid signer details.");
  }
  return parsed.data;
}

export async function prepareSendContext(
  input: {
    store: SignatureStore;
    provider: Pick<SignatureProvider, "name" | "cancelSignatureRequest">;
    firmId: string;
    agreementId: string;
    actorUserId: string;
    replaceActive?: boolean;
    now?: Date;
  },
  desiredMode: SigningMode,
) {
  let context = await input.store.loadSendContext(input.firmId, input.agreementId);
  if (!context || context.firmId !== input.firmId) {
    throw new SignatureWorkflowError("Agreement not found.");
  }

  const active = context.activeRequest;
  if (
    active &&
    (active.signingMode !== desiredMode || active.provider !== input.provider.name)
  ) {
    if (!input.replaceActive) {
      throw new SignatureWorkflowError(
        "A signature request is already outstanding for this agreement.",
      );
    }
    await cancelSignatureRequest({
      store: input.store,
      provider: input.provider,
      firmId: input.firmId,
      agreementId: input.agreementId,
      actorUserId: input.actorUserId,
      now: input.now,
    });
    context = await input.store.loadSendContext(input.firmId, input.agreementId);
    if (!context || context.firmId !== input.firmId) {
      throw new SignatureWorkflowError("Agreement not found.");
    }
  }

  if (!context.activeRequest && context.agreementStatus !== "generated") {
    throw new SignatureWorkflowError(
      "Only a generated agreement can be sent for signature.",
    );
  }

  return context;
}

async function loadPackFields(
  store: SignatureStore,
  context: { packStoragePath: string },
  requirePageInitialsInput?: boolean,
) {
  const packBytes = await store.downloadGeneratedPack(context.packStoragePath);
  if (!packBytes) {
    throw new SignatureWorkflowError("The generated agreement pack could not be retrieved.");
  }
  const requirePageInitials = requirePageInitialsInput !== false;
  const pages = await pageGeometriesFromPdf(packBytes);
  const formFields = formFieldsPerDocument(pages, requirePageInitials);
  return {
    packBytes,
    requirePageInitials,
    pageCount: pages.length,
    formFields,
    initialsFieldCount: formFields?.[0]?.length ?? 0,
  };
}

export function issueSigningToken(now?: Date) {
  const issued = createSigningToken();
  return {
    token: issued.token,
    hash: issued.hash,
    expiresAt: signingTokenExpiresAt(now),
  };
}

export async function rotateSigningToken(input: {
  store: SignatureStore;
  request: SignatureRequestRecord;
  actorUserId: string;
  now?: Date;
}): Promise<EmbeddedSigningResult> {
  if (!["sent", "viewed"].includes(input.request.status)) {
    throw new SignatureWorkflowError("This signing session cannot be reopened.");
  }
  const issued = issueSigningToken(input.now);
  const request = await input.store.updateRequest(input.request.id, {
    signingTokenHash: issued.hash,
    signingTokenExpiresAt: issued.expiresAt,
    lastError: null,
  });
  await input.store.insertAudit({
    firmId: request.firmId,
    actorUserId: input.actorUserId,
    entityType: "costs_agreement",
    entityId: request.costsAgreementId,
    action: "signing_session_reopened",
    payload: {
      signatureRequestId: request.id,
      signingMode: request.signingMode,
    },
  });
  return {
    request,
    token: issued.token,
    signingUrl: publicSigningUrl(issued.token),
  };
}
