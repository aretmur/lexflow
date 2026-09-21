import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EMAIL_SEND_FAILED, EmailProviderError, getEmailProvider } from "@/lib/email/provider";
import { signingLinkEmail, signingOtpEmail } from "@/lib/email/templates";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { signedAgreementStoragePath } from "@/lib/documents/pdf/storage-path";
import { CONSENT_TEXT_VERSION, consentText } from "@/lib/signatures/consent";
import { executionPageNumber } from "@/lib/signatures/execution-layout";
import { pageGeometriesFromPdf } from "@/lib/signatures/form-fields";
import {
  createOtpCode,
  hashOtpCode,
  isOtpExpired,
  OTP_MAX_ATTEMPTS,
  otpCodesEqual,
  otpExpiresAt,
  otpResendAllowed,
} from "@/lib/signatures/otp";
import { consumeRateLimit } from "@/lib/signatures/rate-limit";
import {
  hashSigningToken,
  isSigningTokenExpired,
  publicSigningUrl,
} from "@/lib/signatures/signing-token";
import { stampExecutedPdf, type SignatureMark } from "@/lib/signatures/stamp";
import type { SignatureStore } from "@/lib/signatures/store";
import {
  SignatureWorkflowError,
  type SignatureRequestRecord,
  type SignatureSigner,
  type SigningMode,
} from "@/lib/signatures/types";
import {
  issueSigningToken,
  parseSigner,
  prepareSendContext,
  rotateSigningToken,
} from "@/lib/signatures/workflow";

export const LEGACY_PACK_SIGNING_ERROR =
  "This agreement was generated before signing metadata was added. Create a new agreement version and generate it again before signing.";

const nativeModes = ["qr", "email", "same_device"] as const;
type NativeSigningMode = (typeof nativeModes)[number];

export type NativeSessionView =
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "unavailable" }
  | { status: "completed"; signerName: string }
  | {
      status: "needs_otp";
      signerName: string;
      signerEmail: string;
      firmName: string;
      testMode: boolean;
      signingMode: SigningMode;
    }
  | {
      status: "ready";
      signerName: string;
      signerEmail: string;
      firmName: string;
      testMode: boolean;
      signingMode: SigningMode;
      requirePageInitials: boolean;
      pageCount: number;
      consentText: string;
      consentTextVersion: string;
    };

export type NativeCompleteInput = {
  store: SignatureStore;
  token: string;
  consentAccepted: boolean;
  signerName: string;
  signedDate: string;
  signature: SignatureMark;
  initials: SignatureMark;
  initialledPages: number[];
  signerIp?: string | null;
  signerUserAgent?: string | null;
  now?: Date;
};

export async function startNativeSigning(input: {
  store: SignatureStore;
  provider: { name: "native_lexflow"; cancelSignatureRequest: (id: string) => Promise<void> };
  firmId: string;
  firmName: string;
  agreementId: string;
  actorUserId: string;
  signer: SignatureSigner;
  testMode: boolean;
  signingMode: NativeSigningMode;
  requirePageInitials?: boolean;
  requireEmailOtpForQr?: boolean;
  emailReplyTo?: string | null;
  replaceActive?: boolean;
  now?: Date;
}) {
  const signer = parseSigner(input.signer);
  const context = await prepareSendContext(input, input.signingMode);
  const pageSplit = requirePackPageSplit(context);
  if (context.activeRequest && isNativeMode(context.activeRequest.signingMode)) {
    const rotated = await rotateSigningToken({
      store: input.store,
      request: context.activeRequest,
      actorUserId: input.actorUserId,
      now: input.now,
    });
    if (input.signingMode === "email") {
      await deliverSigningLinkEmail({
        store: input.store,
        request: rotated.request,
        signer,
        signingUrl: rotated.signingUrl,
        firmName: input.firmName,
        replyTo: input.emailReplyTo,
        now: input.now,
      });
    }
    return rotated;
  }

  const packBytes = await input.store.downloadGeneratedPack(context.packStoragePath);
  if (!packBytes) {
    throw new SignatureWorkflowError("The generated agreement pack could not be retrieved.");
  }
  if (sha256Hex(packBytes) !== context.packSha256) {
    throw new SignatureWorkflowError("The generated agreement pack could not be verified.");
  }

  const pages = await pageGeometriesFromPdf(packBytes);
  const requirePageInitials = input.requirePageInitials !== false;
  const issued = issueSigningToken(input.now);
  const startedAt = (input.now ?? new Date()).toISOString();
  const providerRequestId = `native_${randomUUID()}`;
  const emailMode = input.signingMode === "email";

  const request = await input.store.insertRequest({
    firmId: context.firmId,
    costsAgreementId: context.agreementId,
    agreementVersionId: context.versionId,
    generatedPackId: context.packId,
    provider: "native_lexflow",
    providerRequestId,
    signerName: signer.name,
    signerEmail: signer.email,
    status: "sent",
    testMode: input.testMode,
    sentAt: emailMode ? null : startedAt,
    createdBy: input.actorUserId,
    requirePageInitials,
    initialsFieldCount: requirePageInitials ? pages.length : 0,
    pageCount: pages.length,
    signingMode: input.signingMode,
    signingTokenHash: issued.hash,
    signingTokenExpiresAt: issued.expiresAt,
    startedAt,
    initiatedByUserId: input.actorUserId,
    generatedDocumentSha256: context.packSha256,
    executionPage: executionPageNumber(pageSplit.agreementPageCount, pages.length),
    agreementPageCount: pageSplit.agreementPageCount,
    firmDisplayName: input.firmName,
    emailVerifiedAt: emailMode || input.requireEmailOtpForQr ? null : startedAt,
  });

  await input.store.updateAgreementStatus(context.firmId, context.agreementId, "sent", [
    "generated",
  ]);
  await input.store.insertAudit({
    firmId: context.firmId,
    actorUserId: input.actorUserId,
    entityType: "costs_agreement",
    entityId: context.agreementId,
    action: "signature_request_sent",
    payload: {
      signatureRequestId: request.id,
      provider: "native_lexflow",
      signingMode: input.signingMode,
      signerName: signer.name,
      signerEmail: signer.email,
      requirePageInitials,
      pageCount: pages.length,
      initiatedByUserId: input.actorUserId,
    },
  });

  const signingUrl = publicSigningUrl(issued.token);
  if (emailMode) {
    await deliverSigningLinkEmail({
      store: input.store,
      request,
      signer,
      signingUrl,
      firmName: input.firmName,
      replyTo: input.emailReplyTo,
      now: input.now,
    });
  }

  return { request, token: issued.token, signingUrl };
}

export async function resolveNativeSigningSession(input: {
  store: SignatureStore;
  token: string;
  now?: Date;
}): Promise<NativeSessionView> {
  if (!consumeRateLimit(`session:${hashSigningToken(input.token)}`, 60, 10 * 60 * 1000)) {
    return { status: "unavailable" };
  }
  const request = await loadActiveNativeRequest(input.store, input.token);
  if (!request) {
    return { status: "invalid" };
  }
  if (request.status === "signed" || request.signedAt) {
    return { status: "completed", signerName: request.signerName };
  }
  if (["cancelled", "declined", "expired", "failed"].includes(request.status)) {
    return { status: "unavailable" };
  }
  if (isSigningTokenExpired(request.signingTokenExpiresAt, input.now)) {
    return { status: "expired" };
  }

  const firmName = request.firmDisplayName || "Lexflow";
  if (requiresOtp(request) && !request.emailVerifiedAt) {
    return {
      status: "needs_otp",
      signerName: request.signerName,
      signerEmail: request.signerEmail,
      firmName,
      testMode: request.testMode,
      signingMode: request.signingMode,
    };
  }

  if (!request.viewedAt) {
    await input.store.updateRequest(request.id, {
      status: "viewed",
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
    signerName: request.signerName,
    signerEmail: request.signerEmail,
    firmName,
    testMode: request.testMode,
    signingMode: request.signingMode,
    requirePageInitials: request.requirePageInitials,
    pageCount: request.pageCount,
    consentText: consentText(request.signerName),
    consentTextVersion: CONSENT_TEXT_VERSION,
  };
}

export async function sendNativeSigningOtp(input: {
  store: SignatureStore;
  token: string;
  now?: Date;
}) {
  if (!consumeRateLimit(`otp-send:${hashSigningToken(input.token)}`, 8, 10 * 60 * 1000)) {
    throw new SignatureWorkflowError("Too many verification emails. Try again shortly.");
  }
  const request = await loadActiveNativeRequest(input.store, input.token);
  if (!request) {
    throw new SignatureWorkflowError("Signing session expired.");
  }
  if (!requiresOtp(request)) {
    return;
  }
  if (request.emailVerifiedAt) {
    return;
  }
  if (!otpResendAllowed(request.lastOtpSentAt, input.now)) {
    throw new SignatureWorkflowError("Wait a moment before requesting another code.");
  }
  const code = createOtpCode();
  const now = input.now ?? new Date();
  const hashed = hashOtpCode(request.id, code);
  await input.store.updateRequest(request.id, {
    otpHash: hashed,
    otpExpiresAt: otpExpiresAt(now),
    otpAttemptCount: 0,
  });
  const message = signingOtpEmail({
    clientName: request.signerName,
    firmName: request.firmDisplayName || "Lexflow",
    code,
  });
  try {
    await getEmailProvider().send({
      to: request.signerEmail,
      subject: message.subject,
      text: message.text,
    });
  } catch (error) {
    throw new SignatureWorkflowError(safeEmailError(error));
  }
  await input.store.updateRequest(request.id, {
    lastOtpSentAt: now.toISOString(),
  });
}

export async function verifyNativeSigningOtp(input: {
  store: SignatureStore;
  token: string;
  code: string;
  now?: Date;
}) {
  if (!consumeRateLimit(`otp-verify:${hashSigningToken(input.token)}`, 12, 10 * 60 * 1000)) {
    throw new SignatureWorkflowError("Too many attempts. Try again shortly.");
  }
  const request = await loadActiveNativeRequest(input.store, input.token);
  if (!request) {
    throw new SignatureWorkflowError("Signing session expired.");
  }
  if (request.emailVerifiedAt) {
    return;
  }
  if ((request.otpAttemptCount ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new SignatureWorkflowError("Too many incorrect codes. Ask your lawyer to reopen signing.");
  }
  if (!request.otpHash || isOtpExpired(request.otpExpiresAt, input.now)) {
    await input.store.updateRequest(request.id, {
      otpAttemptCount: (request.otpAttemptCount ?? 0) + 1,
    });
    throw new SignatureWorkflowError("That code has expired. Request a new code.");
  }
  if (!otpCodesEqual(request.otpHash, hashOtpCode(request.id, input.code))) {
    await input.store.updateRequest(request.id, {
      otpAttemptCount: (request.otpAttemptCount ?? 0) + 1,
    });
    throw new SignatureWorkflowError("That code is incorrect.");
  }
  await input.store.updateRequest(request.id, {
    emailVerifiedAt: (input.now ?? new Date()).toISOString(),
    otpHash: null,
    otpExpiresAt: null,
    otpAttemptCount: request.otpAttemptCount,
  });
}

export async function loadNativeSigningPack(input: {
  store: SignatureStore;
  token: string;
  now?: Date;
}) {
  if (!consumeRateLimit(`pack:${hashSigningToken(input.token)}`, 30, 10 * 60 * 1000)) {
    throw new SignatureWorkflowError("Too many document requests. Try again shortly.");
  }
  const request = await loadActiveNativeRequest(input.store, input.token);
  if (!request) {
    throw new SignatureWorkflowError("Signing session expired.");
  }
  if (requiresOtp(request) && !request.emailVerifiedAt) {
    throw new SignatureWorkflowError("Verify your email before reviewing the agreement.");
  }
  const context = await input.store.loadSendContext(request.firmId, request.costsAgreementId);
  if (!context) {
    throw new SignatureWorkflowError("Agreement not found.");
  }
  const bytes = await input.store.downloadGeneratedPack(context.packStoragePath);
  if (!bytes) {
    throw new SignatureWorkflowError("The agreement pack could not be retrieved.");
  }
  return { bytes, fileName: `agreement-pack-v${context.packVersionNumber}.pdf` };
}

export async function completeNativeSigning(input: NativeCompleteInput) {
  if (!consumeRateLimit(`complete:${hashSigningToken(input.token)}`, 6, 10 * 60 * 1000)) {
    throw new SignatureWorkflowError("Too many signing attempts. Try again shortly.");
  }
  const request = await loadActiveNativeRequest(input.store, input.token);
  if (!request) {
    throw new SignatureWorkflowError("Signing session expired.");
  }
  if (request.status === "signed" || request.signedAt) {
    const existing = await input.store.loadSignedDocumentByRequest(request.id);
    if (existing) {
      return existing;
    }
  }
  if (!["sent", "viewed"].includes(request.status)) {
    throw new SignatureWorkflowError("This signing session cannot be completed.");
  }
  if (requiresOtp(request) && !request.emailVerifiedAt) {
    throw new SignatureWorkflowError("Verify your email before signing.");
  }
  if (!input.consentAccepted) {
    throw new SignatureWorkflowError("Confirm the signing statement before continuing.");
  }
  const name = z.string().trim().min(1).max(200).safeParse(input.signerName);
  if (!name.success) {
    throw new SignatureWorkflowError("Enter your full name.");
  }
  if (name.data.toLowerCase() !== request.signerName.trim().toLowerCase() && name.data.length < 2) {
    throw new SignatureWorkflowError("Enter your full name.");
  }

  const context = await input.store.loadSendContext(request.firmId, request.costsAgreementId);
  if (!context) {
    throw new SignatureWorkflowError("Agreement not found.");
  }
  const pageSplit = requirePackPageSplit({
    agreementPageCount: request.agreementPageCount ?? context.agreementPageCount,
    attachmentPageCount: context.attachmentPageCount,
  });
  const packBytes = await input.store.downloadGeneratedPack(context.packStoragePath);
  if (!packBytes) {
    throw new SignatureWorkflowError("The generated agreement pack could not be retrieved.");
  }
  const expectedHash = request.generatedDocumentSha256 ?? context.packSha256;
  const now = input.now ?? new Date();
  const stamped = await stampExecutedPdf({
    packBytes,
    expectedSha256: expectedHash,
    requirePageInitials: request.requirePageInitials,
    agreementPageCount: pageSplit.agreementPageCount,
    initials: input.initials,
    initialledPages: input.initialledPages,
    signature: input.signature,
    signerName: name.data,
    signedDate: input.signedDate,
  });

  const path = signedAgreementStoragePath({
    firmId: request.firmId,
    agreementId: request.costsAgreementId,
    versionNumber: context.versionNumber,
  });
  await input.store.uploadSignedPdf(path, stamped.bytes);

  let signed;
  try {
    signed = await input.store.insertSignedDocument({
      firmId: request.firmId,
      costsAgreementId: request.costsAgreementId,
      agreementVersionId: request.agreementVersionId,
      signatureRequestId: request.id,
      storagePath: path,
      sha256: stamped.sha256,
      pageCount: stamped.pageCount,
      byteSize: stamped.bytes.byteLength,
      signedAt: now.toISOString(),
    });
  } catch (error) {
    const existing = await input.store.loadSignedDocumentByRequest(request.id);
    if (existing) {
      return existing;
    }
    throw error;
  }

  await input.store.updateRequest(request.id, {
    status: "signed",
    signedAt: now.toISOString(),
    completedAt: now.toISOString(),
    consentedAt: now.toISOString(),
    consentTextVersion: CONSENT_TEXT_VERSION,
    initialledPageCount: request.requirePageInitials ? input.initialledPages.length : 0,
    signerIp: input.signerIp ?? null,
    signerUserAgent: input.signerUserAgent ?? null,
    signedDocumentSha256: stamped.sha256,
    otpHash: null,
    otpExpiresAt: null,
    lastError: null,
  });
  await input.store.updateAgreementStatus(
    request.firmId,
    request.costsAgreementId,
    "signed",
    ["sent", "viewed", "signed"],
  );
  await input.store.markVersionExecuted(
    request.firmId,
    request.agreementVersionId,
    now.toISOString(),
  );

  const auditPayload = {
    firmId: request.firmId,
    agreementId: request.costsAgreementId,
    agreementVersionId: request.agreementVersionId,
    generatedPdfSha256: expectedHash,
    signedPdfSha256: stamped.sha256,
    signerName: name.data,
    signerEmail: request.signerEmail,
    signingMethod: request.signingMode,
    emailVerifiedAt: request.emailVerifiedAt,
    sessionCreatedAt: request.createdAt,
    documentOpenedAt: request.viewedAt,
    consentAt: now.toISOString(),
    consentTextVersion: CONSENT_TEXT_VERSION,
    initialsCompletedAt: now.toISOString(),
    signatureAt: now.toISOString(),
    completionAt: now.toISOString(),
    ipAddress: input.signerIp ?? null,
    userAgent: input.signerUserAgent ?? null,
    initiatingLawyerUserId: request.initiatedByUserId ?? request.createdBy,
    initialledPages: input.initialledPages,
  };

  await input.store.insertSigningAudit({
    firmId: request.firmId,
    costsAgreementId: request.costsAgreementId,
    agreementVersionId: request.agreementVersionId,
    signatureRequestId: request.id,
    payload: auditPayload,
  });
  await input.store.insertAudit({
    firmId: request.firmId,
    actorUserId: null,
    entityType: "costs_agreement",
    entityId: request.costsAgreementId,
    action: "agreement_signed",
    payload: auditPayload,
  });

  return signed;
}

export async function resendNativeSigningLink(input: {
  store: SignatureStore;
  firmId: string;
  agreementId: string;
  actorUserId: string;
  firmName?: string;
  emailReplyTo?: string | null;
  now?: Date;
}) {
  const request = await requireActiveNative(input);
  const rotated = await rotateSigningToken({
    store: input.store,
    request,
    actorUserId: input.actorUserId,
    now: input.now,
  });
  await deliverSigningLinkEmail({
    store: input.store,
    request: rotated.request,
    signer: { name: rotated.request.signerName, email: rotated.request.signerEmail },
    signingUrl: rotated.signingUrl,
    firmName: input.firmName || rotated.request.firmDisplayName || "Lexflow",
    replyTo: input.emailReplyTo,
    now: input.now,
  });
  return rotated;
}

export async function reopenNativeSigningSession(input: {
  store: SignatureStore;
  firmId: string;
  agreementId: string;
  actorUserId: string;
  now?: Date;
}) {
  return rotateSigningToken({
    store: input.store,
    request: await requireActiveNative(input),
    actorUserId: input.actorUserId,
    now: input.now,
  });
}

function requiresOtp(request: SignatureRequestRecord) {
  return request.signingMode === "email" || !request.emailVerifiedAt;
}

function requirePackPageSplit(context: {
  agreementPageCount: number | null;
  attachmentPageCount: number | null;
}) {
  if (context.agreementPageCount == null || context.attachmentPageCount == null) {
    throw new SignatureWorkflowError(LEGACY_PACK_SIGNING_ERROR);
  }
  return {
    agreementPageCount: context.agreementPageCount,
    attachmentPageCount: context.attachmentPageCount,
  };
}

function isNativeMode(mode: SigningMode) {
  return (nativeModes as readonly string[]).includes(mode);
}

async function loadActiveNativeRequest(store: SignatureStore, token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const request = await store.loadRequestByTokenHash(hashSigningToken(trimmed));
  if (!request || request.provider !== "native_lexflow") {
    return null;
  }
  return request;
}

async function requireActiveNative(input: {
  store: SignatureStore;
  firmId: string;
  agreementId: string;
}) {
  const context = await input.store.loadSendContext(input.firmId, input.agreementId);
  const request = context?.activeRequest;
  if (!context || context.firmId !== input.firmId || !request) {
    throw new SignatureWorkflowError("There is no outstanding signing session.");
  }
  if (request.provider !== "native_lexflow") {
    throw new SignatureWorkflowError("This signature request is not a Lexflow signing session.");
  }
  return request;
}

async function deliverSigningLinkEmail(input: {
  store: SignatureStore;
  request: SignatureRequestRecord;
  signer: SignatureSigner;
  signingUrl: string;
  firmName: string;
  replyTo?: string | null;
  now?: Date;
}) {
  const message = signingLinkEmail({
    clientName: input.signer.name,
    firmName: input.firmName,
    signingUrl: input.signingUrl,
  });
  try {
    const result = await getEmailProvider().send({
      to: input.signer.email,
      subject: message.subject,
      text: message.text,
      replyTo: input.replyTo?.trim() || undefined,
    });
    const sentAt = (input.now ?? new Date()).toISOString();
    await input.store.updateRequest(input.request.id, {
      sentAt,
      lastError: null,
      emailProvider: result.provider,
      emailMessageId: result.messageId,
      emailSentAt: sentAt,
    });
  } catch (error) {
    const safe = safeEmailError(error);
    await input.store.updateRequest(input.request.id, {
      lastError: safe,
      emailSentAt: null,
    });
    throw new SignatureWorkflowError(safe);
  }
}

function safeEmailError(error: unknown) {
  if (error instanceof EmailProviderError) {
    return error.message;
  }
  return EMAIL_SEND_FAILED;
}
