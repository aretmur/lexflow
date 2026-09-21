import type { SigningMode } from "@/lib/types/enums";

export const SIGNING_MODES = [
  "embedded_same_device",
  "embedded_qr",
  "email",
  "qr",
  "same_device",
] as const;
export type { SigningMode };

export const SIGNATURE_PROVIDERS = ["dropbox_sign", "native_lexflow"] as const;
export type SignatureProviderName = (typeof SIGNATURE_PROVIDERS)[number];

export const SIGNATURE_REQUEST_STATUSES = [
  "pending",
  "sent",
  "viewed",
  "signed",
  "declined",
  "cancelled",
  "expired",
  "failed",
] as const;
export type SignatureRequestStatus = (typeof SIGNATURE_REQUEST_STATUSES)[number];

export const SIGNATURE_WEBHOOK_EVENT_TYPES = [
  "sent",
  "viewed",
  "signed",
  "completed",
  "downloadable",
  "declined",
  "cancelled",
  "expired",
  "failed",
  "ignored",
] as const;
export type SignatureWebhookEventType = (typeof SIGNATURE_WEBHOOK_EVENT_TYPES)[number];

export const ACTIVE_SIGNATURE_REQUEST_STATUSES = [
  "pending",
  "sent",
  "viewed",
] as const satisfies readonly SignatureRequestStatus[];

export type SignatureSigner = {
  name: string;
  email: string;
};

export type CreateSignatureRequestInput = {
  title: string;
  subject: string;
  message?: string;
  fileName: string;
  fileBytes: Uint8Array;
  signer: SignatureSigner;
  metadata: Record<string, string>;
  signingRedirectUrl: string;
  testMode: boolean;
  clientId?: string;
  formFieldsPerDocument?: Array<
    Array<{
      api_id: string;
      name: string;
      type: "initials";
      x: number;
      y: number;
      width: number;
      height: number;
      required: boolean;
      signer: number;
      page: number;
    }>
  >;
};

export type CreateSignatureRequestResult = {
  providerRequestId: string;
  providerSignatureId?: string;
};

export type CreateEmbeddedSignatureRequestResult = {
  providerRequestId: string;
  providerSignatureId: string;
};

export type EmbeddedSignUrl = {
  signUrl: string;
  expiresAt: string;
};

export type SignatureRequestDetails = {
  providerRequestId: string;
  isComplete: boolean;
  isDeclined: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  signerEmail: string | null;
};

export type ProviderWebhookEvent = {
  eventId: string;
  eventType: SignatureWebhookEventType;
  providerEventType: string;
  providerRequestId: string | null;
  occurredAt: string;
  eventHash: string;
};

export type VerifyWebhookInput = {
  eventTime: string;
  eventType: string;
  eventHash: string;
};

export interface SignatureProvider {
  readonly name: SignatureProviderName;
  createSignatureRequest(
    input: CreateSignatureRequestInput,
  ): Promise<CreateSignatureRequestResult>;
  createEmbeddedSignatureRequest(
    input: CreateSignatureRequestInput,
  ): Promise<CreateEmbeddedSignatureRequestResult>;
  getEmbeddedSignUrl(providerSignatureId: string): Promise<EmbeddedSignUrl>;
  getSignatureRequest(providerRequestId: string): Promise<SignatureRequestDetails>;
  cancelSignatureRequest(providerRequestId: string): Promise<void>;
  remindSignatureRequest(providerRequestId: string, email: string): Promise<void>;
  downloadSignedDocument(providerRequestId: string): Promise<Uint8Array>;
  verifyWebhook(input: VerifyWebhookInput): boolean;
  parseWebhook(payload: unknown): ProviderWebhookEvent;
}

export type SignatureRequestRecord = {
  id: string;
  firmId: string;
  costsAgreementId: string;
  agreementVersionId: string;
  generatedPackId: string;
  provider: SignatureProviderName;
  providerRequestId: string | null;
  signerName: string;
  signerEmail: string;
  status: SignatureRequestStatus;
  testMode: boolean;
  lastError: string | null;
  lastWebhookEventId: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  requirePageInitials: boolean;
  initialsFieldCount: number;
  pageCount: number;
  signingMode: SigningMode;
  providerSignatureId: string | null;
  signingTokenHash: string | null;
  signingTokenExpiresAt: string | null;
  emailVerifiedAt: string | null;
  otpHash: string | null;
  otpExpiresAt: string | null;
  otpAttemptCount: number;
  lastOtpSentAt: string | null;
  initialledPageCount: number;
  consentTextVersion: string | null;
  consentedAt: string | null;
  startedAt: string | null;
  initiatedByUserId: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  generatedDocumentSha256: string | null;
  signedDocumentSha256: string | null;
  executionPage: number | null;
  agreementPageCount: number | null;
  firmDisplayName: string | null;
  emailProvider: string | null;
  emailMessageId: string | null;
  emailSentAt: string | null;
};

export type SignedAgreementDocumentRecord = {
  id: string;
  firmId: string;
  costsAgreementId: string;
  agreementVersionId: string;
  signatureRequestId: string;
  storagePath: string;
  sha256: string;
  pageCount: number;
  byteSize: number;
  signedAt: string;
  createdAt: string;
};

export type SignatureSendContext = {
  agreementId: string;
  firmId: string;
  agreementStatus: string;
  versionId: string;
  versionNumber: number;
  packId: string;
  packStoragePath: string;
  packVersionNumber: number;
  packSha256: string;
  packPageCount: number;
  agreementPageCount: number | null;
  attachmentPageCount: number | null;
  activeRequest: SignatureRequestRecord | null;
};

export class SignatureProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureProviderError";
  }
}

export class SignatureWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureWorkflowError";
  }
}
