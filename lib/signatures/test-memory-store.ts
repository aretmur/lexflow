import { randomUUID } from "node:crypto";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { firmSigningEmailIdentity } from "@/lib/email/identity";
import type { SignatureStore } from "@/lib/signatures/store";
import {
  SignatureWorkflowError,
  type FirmSigningContact,
  type SignatureRequestRecord,
  type SignedAgreementDocumentRecord,
  type SignedDocumentDeliveryRecord,
} from "@/lib/signatures/types";

export const FIRM = "11111111-1111-1111-1111-111111111111";
export const OTHER_FIRM = "22222222-2222-2222-2222-222222222222";
export const AGREEMENT = "33333333-3333-3333-3333-333333333333";
export const VERSION = "44444444-4444-4444-4444-444444444444";
export const PACK = "55555555-5555-5555-5555-555555555555";
export const USER = "66666666-6666-6666-6666-666666666666";

export function memoryStore(initial?: {
  agreementStatus?: string;
  firmId?: string;
  packBytes?: Uint8Array;
  packPageCount?: number;
  agreementPageCount?: number | null;
  attachmentPageCount?: number | null;
  signingContact?: FirmSigningContact | null;
}): SignatureStore & {
  requests: SignatureRequestRecord[];
  documents: SignedAgreementDocumentRecord[];
  deliveries: SignedDocumentDeliveryRecord[];
  events: string[];
  audits: string[];
  agreementStatus: string;
  uploads: string[];
  uploadedBytes: Uint8Array[];
} {
  const state = {
    requests: [] as SignatureRequestRecord[],
    documents: [] as SignedAgreementDocumentRecord[],
    deliveries: [] as SignedDocumentDeliveryRecord[],
    events: [] as string[],
    audits: [] as string[],
    agreementStatus: initial?.agreementStatus ?? "generated",
    uploads: [] as string[],
    uploadedBytes: [] as Uint8Array[],
    packBytes: initial?.packBytes ?? new Uint8Array([37, 80, 68, 70]),
    firmId: initial?.firmId ?? FIRM,
    signingContact:
      initial?.signingContact === undefined
        ? firmSigningEmailIdentity({
            name: "Example Law",
            signing_sender_email: "intake@example.com",
            signing_reply_to_email: "intake@example.com",
          })
        : initial.signingContact,
  };

  const store: SignatureStore & {
    requests: SignatureRequestRecord[];
    documents: SignedAgreementDocumentRecord[];
    deliveries: SignedDocumentDeliveryRecord[];
    events: string[];
    audits: string[];
    agreementStatus: string;
    uploads: string[];
    uploadedBytes: Uint8Array[];
  } = {
    ...state,
    async loadSendContext(firmId, agreementId) {
      if (firmId !== state.firmId || agreementId !== AGREEMENT) {
        return null;
      }
      return {
        agreementId: AGREEMENT,
        firmId: state.firmId,
        agreementStatus: state.agreementStatus,
        versionId: VERSION,
        versionNumber: 1,
        packId: PACK,
        packStoragePath: `${FIRM}/${AGREEMENT}/version-1/agreement-pack.pdf`,
        packVersionNumber: 1,
        packSha256: sha256Hex(state.packBytes),
        packPageCount: initial?.packPageCount ?? 1,
        agreementPageCount: initial?.agreementPageCount === undefined ? 1 : initial.agreementPageCount,
        attachmentPageCount:
          initial?.attachmentPageCount === undefined ? 0 : initial.attachmentPageCount,
        activeRequest:
          state.requests.find((request) =>
            ["pending", "sent", "viewed"].includes(request.status),
          ) ?? null,
      };
    },
    async loadRequestById(_firmId, requestId) {
      return state.requests.find((request) => request.id === requestId) ?? null;
    },
    async loadRequestByProviderId(providerRequestId) {
      return (
        state.requests.find((request) => request.providerRequestId === providerRequestId) ??
        null
      );
    },
    async loadRequestByTokenHash(tokenHash) {
      return (
        state.requests.find((request) => request.signingTokenHash === tokenHash) ?? null
      );
    },
    async loadLatestRequest(firmId, agreementId) {
      return (
        [...state.requests]
          .reverse()
          .find(
            (request) =>
              request.firmId === firmId && request.costsAgreementId === agreementId,
          ) ?? null
      );
    },
    async loadSignedDocument(firmId, agreementId) {
      return (
        state.documents.find(
          (document) =>
            document.firmId === firmId && document.costsAgreementId === agreementId,
        ) ?? null
      );
    },
    async loadSignedDocumentByRequest(signatureRequestId) {
      return (
        state.documents.find((document) => document.signatureRequestId === signatureRequestId) ??
        null
      );
    },
    async downloadGeneratedPack() {
      return state.packBytes;
    },
    async uploadSignedPdf(storagePath, bytes) {
      if (state.uploads.includes(storagePath)) {
        return;
      }
      state.uploads.push(storagePath);
      state.uploadedBytes.push(bytes);
    },
    async insertRequest(input) {
      const record: SignatureRequestRecord = {
        id: `req-${state.requests.length + 1}`,
        firmId: input.firmId,
        costsAgreementId: input.costsAgreementId,
        agreementVersionId: input.agreementVersionId,
        generatedPackId: input.generatedPackId,
        provider: input.provider,
        providerRequestId: input.providerRequestId,
        signerName: input.signerName,
        signerEmail: input.signerEmail,
        status: input.status,
        testMode: input.testMode,
        lastError: null,
        lastWebhookEventId: null,
        sentAt: input.sentAt,
        viewedAt: null,
        signedAt: null,
        declinedAt: null,
        completedAt: null,
        cancelledAt: null,
        expiredAt: null,
        createdBy: input.createdBy,
        createdAt: input.startedAt ?? input.sentAt ?? new Date().toISOString(),
        updatedAt: input.startedAt ?? input.sentAt ?? new Date().toISOString(),
        requirePageInitials: input.requirePageInitials,
        initialsFieldCount: input.initialsFieldCount,
        pageCount: input.pageCount,
        signingMode: input.signingMode,
        providerSignatureId: input.providerSignatureId ?? null,
        signingTokenHash: input.signingTokenHash ?? null,
        signingTokenExpiresAt: input.signingTokenExpiresAt ?? null,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        otpHash: input.otpHash ?? null,
        otpExpiresAt: input.otpExpiresAt ?? null,
        otpAttemptCount: input.otpAttemptCount ?? 0,
        lastOtpSentAt: input.lastOtpSentAt ?? null,
        initialledPageCount: input.initialledPageCount ?? 0,
        consentTextVersion: input.consentTextVersion ?? null,
        consentedAt: input.consentedAt ?? null,
        startedAt: input.startedAt ?? input.sentAt,
        initiatedByUserId: input.initiatedByUserId ?? input.createdBy,
        signerIp: input.signerIp ?? null,
        signerUserAgent: input.signerUserAgent ?? null,
        generatedDocumentSha256: input.generatedDocumentSha256 ?? null,
        signedDocumentSha256: input.signedDocumentSha256 ?? null,
        executionPage: input.executionPage ?? null,
        agreementPageCount: input.agreementPageCount ?? null,
        firmDisplayName: input.firmDisplayName ?? null,
        emailProvider: input.emailProvider ?? null,
        emailMessageId: input.emailMessageId ?? null,
        emailSentAt: input.emailSentAt ?? null,
      };
      state.requests.push(record);
      return record;
    },
    async updateRequest(requestId, patch) {
      const request = state.requests.find((row) => row.id === requestId);
      if (!request) {
        throw new SignatureWorkflowError("missing");
      }
      Object.assign(request, patch);
      return request;
    },
    async updateAgreementStatus(_firmId, _agreementId, status) {
      state.agreementStatus = status;
      store.agreementStatus = status;
    },
    async markVersionExecuted() {
      return;
    },
    async insertSignedDocument(input) {
      if (state.documents.some((document) => document.signatureRequestId === input.signatureRequestId)) {
        throw new SignatureWorkflowError("Signed agreement documents are immutable");
      }
      const record: SignedAgreementDocumentRecord = {
        id: "signed-1",
        createdAt: input.signedAt,
        ...input,
      };
      state.documents.push(record);
      return record;
    },
    async claimWebhookEvent(input) {
      if (state.events.includes(input.providerEventId)) {
        return false;
      }
      state.events.push(input.providerEventId);
      return true;
    },
    async insertAudit(input) {
      state.audits.push(input.action);
    },
    async insertSigningAudit() {
      return;
    },
    async loadFirmSigningContact() {
      return state.signingContact;
    },
    async downloadSignedPdf(storagePath) {
      const index = state.uploads.indexOf(storagePath);
      if (index < 0) {
        return null;
      }
      return state.uploadedBytes[index] ?? null;
    },
    async loadDelivery(signedDocumentId, recipientRole) {
      return (
        state.deliveries.find(
          (row) =>
            row.signedDocumentId === signedDocumentId && row.recipientRole === recipientRole,
        ) ?? null
      );
    },
    async listDeliveries(firmId, signedDocumentId) {
      return state.deliveries.filter(
        (row) => row.firmId === firmId && row.signedDocumentId === signedDocumentId,
      );
    },
    async upsertDelivery(input) {
      const now = new Date().toISOString();
      const index = state.deliveries.findIndex(
        (row) =>
          row.signedDocumentId === input.signedDocumentId &&
          row.recipientRole === input.recipientRole,
      );
      const record: SignedDocumentDeliveryRecord = {
        id: input.id || (index >= 0 ? state.deliveries[index].id : randomUUID()),
        firmId: input.firmId,
        signedDocumentId: input.signedDocumentId,
        signatureRequestId: input.signatureRequestId,
        recipientRole: input.recipientRole,
        recipientEmail: input.recipientEmail,
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        status: input.status,
        attemptCount: input.attemptCount,
        lastError: input.lastError,
        sentAt: input.sentAt,
        createdAt: index >= 0 ? state.deliveries[index].createdAt : now,
        updatedAt: now,
      };
      if (index >= 0) {
        state.deliveries[index] = record;
      } else {
        state.deliveries.push(record);
      }
      return record;
    },
  };

  return store;
}
