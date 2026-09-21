import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import type { SignatureStore } from "@/lib/signatures/store";
import {
  cancelSignatureRequest,
  handleProviderEvent,
  sendForSignature,
} from "@/lib/signatures/workflow";
import {
  SignatureProviderError,
  SignatureWorkflowError,
  type ProviderWebhookEvent,
  type SignatureProvider,
  type SignatureRequestRecord,
  type SignedAgreementDocumentRecord,
} from "@/lib/signatures/types";
import type { AgreementStatus } from "@/lib/types/enums";

const FIRM = "11111111-1111-1111-1111-111111111111";
const OTHER_FIRM = "22222222-2222-2222-2222-222222222222";
const AGREEMENT = "33333333-3333-3333-3333-333333333333";
const VERSION = "44444444-4444-4444-4444-444444444444";
const PACK = "55555555-5555-5555-5555-555555555555";
const USER = "66666666-6666-6666-6666-666666666666";

async function signedPdf() {
  const document = await PDFDocument.create();
  document.addPage();
  return document.save();
}

function webhook(
  type: ProviderWebhookEvent["eventType"],
  extras: Partial<ProviderWebhookEvent> = {},
): ProviderWebhookEvent {
  return {
    eventId: extras.eventId ?? `${type}-1`,
    eventType: type,
    providerEventType: `signature_request_${type}`,
    providerRequestId: extras.providerRequestId ?? "sr-1",
    occurredAt: extras.occurredAt ?? "2026-09-21T00:00:00.000Z",
    eventHash: extras.eventHash ?? `${type}-hash`,
  };
}

function memoryStore(initial?: {
  agreementStatus?: string;
  firmId?: string;
  packBytes?: Uint8Array;
}): SignatureStore & {
  requests: SignatureRequestRecord[];
  documents: SignedAgreementDocumentRecord[];
  events: string[];
  audits: string[];
  agreementStatus: string;
  uploads: string[];
} {
  const state = {
    requests: [] as SignatureRequestRecord[],
    documents: [] as SignedAgreementDocumentRecord[],
    events: [] as string[],
    audits: [] as string[],
    agreementStatus: initial?.agreementStatus ?? "generated",
    uploads: [] as string[],
    packBytes: initial?.packBytes ?? new Uint8Array([37, 80, 68, 70]),
    firmId: initial?.firmId ?? FIRM,
  };

  const store: SignatureStore & {
    requests: SignatureRequestRecord[];
    documents: SignedAgreementDocumentRecord[];
    events: string[];
    audits: string[];
    agreementStatus: string;
    uploads: string[];
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
    async uploadSignedPdf(storagePath) {
      if (state.uploads.includes(storagePath)) {
        return;
      }
      state.uploads.push(storagePath);
    },
    async insertRequest(input) {
      const record: SignatureRequestRecord = {
        id: "req-1",
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
        createdAt: input.sentAt,
        updatedAt: input.sentAt,
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
  };

  return store;
}

function mockProvider(overrides: Partial<SignatureProvider> = {}): SignatureProvider & {
  created: number;
  cancelled: number;
  downloads: number;
} {
  const state = { created: 0, cancelled: 0, downloads: 0 };
  return {
    name: "dropbox_sign",
    created: 0,
    cancelled: 0,
    downloads: 0,
    async createSignatureRequest() {
      state.created += 1;
      this.created = state.created;
      return { providerRequestId: "sr-1" };
    },
    async getSignatureRequest(providerRequestId) {
      return {
        providerRequestId,
        isComplete: true,
        isDeclined: false,
        isCancelled: false,
        isExpired: false,
        signerEmail: "john@example.com",
      };
    },
    async cancelSignatureRequest() {
      state.cancelled += 1;
      this.cancelled = state.cancelled;
    },
    async remindSignatureRequest() {
      return;
    },
    async downloadSignedDocument() {
      state.downloads += 1;
      this.downloads = state.downloads;
      return signedPdf();
    },
    verifyWebhook() {
      return true;
    },
    parseWebhook() {
      return webhook("sent");
    },
    ...overrides,
  };
}

describe("send signature request", () => {
  it("records signer metadata and marks the agreement sent", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    const { request } = await sendForSignature({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    expect(request.providerRequestId).toBe("sr-1");
    expect(request.signerName).toBe("John Smith");
    expect(request.signerEmail).toBe("john@example.com");
    expect(request.status).toBe("sent");
    expect(store.agreementStatus).toBe("sent");
    expect(store.audits).toContain("signature_request_sent");
  });

  it("rejects a missing client email and leaves the agreement generated", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    await expect(
      sendForSignature({
        store,
        provider,
        firmId: FIRM,
        agreementId: AGREEMENT,
        actorUserId: USER,
        signer: { name: "John Smith", email: "" },
        testMode: true,
      }),
    ).rejects.toThrow(/email/i);
    expect(store.requests).toHaveLength(0);
    expect(store.agreementStatus).toBe("generated");
    expect(provider.created).toBe(0);
  });

  it("does not mark the agreement sent when the provider fails", async () => {
    const store = memoryStore();
    const provider = mockProvider({
      async createSignatureRequest() {
        throw new SignatureProviderError("Dropbox Sign is unavailable");
      },
    });
    await expect(
      sendForSignature({
        store,
        provider,
        firmId: FIRM,
        agreementId: AGREEMENT,
        actorUserId: USER,
        signer: { name: "John Smith", email: "john@example.com" },
        testMode: true,
      }),
    ).rejects.toThrow(/unavailable|signature/i);
    expect(store.requests).toHaveLength(0);
    expect(store.agreementStatus).toBe("generated");
  });

  it("rejects an unauthorised firm", async () => {
    const store = memoryStore();
    await expect(
      sendForSignature({
        store,
        provider: mockProvider(),
        firmId: OTHER_FIRM,
        agreementId: AGREEMENT,
        actorUserId: USER,
        signer: { name: "John Smith", email: "john@example.com" },
        testMode: true,
      }),
    ).rejects.toThrow(/not found/i);
    expect(store.requests).toHaveLength(0);
  });
});

describe("webhook processing", () => {
  async function sentStore() {
    const store = memoryStore();
    await sendForSignature({
      store,
      provider: mockProvider(),
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
    });
    return store;
  }

  it("records sent and viewed events", async () => {
    const store = await sentStore();
    const provider = mockProvider();
    await handleProviderEvent({ store, provider, event: webhook("sent") });
    await handleProviderEvent({ store, provider, event: webhook("viewed") });
    expect(store.requests[0].status).toBe("viewed");
    expect(store.requests[0].viewedAt).toBe("2026-09-21T00:00:00.000Z");
    expect(store.agreementStatus).toBe("viewed");
  });

  it("downloads and stores the signed PDF on completed/downloadable", async () => {
    const store = await sentStore();
    const provider = mockProvider();
    const bytes = await signedPdf();
    provider.downloadSignedDocument = async () => bytes;
    const result = await handleProviderEvent({
      store,
      provider,
      event: webhook("downloadable"),
    });

    expect(result.ingested?.sha256).toBe(sha256Hex(bytes));
    expect(store.documents).toHaveLength(1);
    expect(store.documents[0].storagePath).toBe(
      `${FIRM}/${AGREEMENT}/version-1/signed-agreement.pdf`,
    );
    expect(store.agreementStatus).toBe("signed");
    expect(store.requests[0].status).toBe("signed");
    expect(store.audits).toContain("agreement_signed");
  });

  it("ignores a duplicate webhook and does not create a second signed document", async () => {
    const store = await sentStore();
    const provider = mockProvider();
    const event = webhook("downloadable", { eventId: "same-event" });
    await handleProviderEvent({ store, provider, event });
    const second = await handleProviderEvent({ store, provider, event });
    expect(second.duplicate).toBe(true);
    expect(store.documents).toHaveLength(1);
    expect(store.uploads).toHaveLength(1);
  });

  it("keeps completed provider status when signed PDF download fails", async () => {
    const store = await sentStore();
    const provider = mockProvider({
      async downloadSignedDocument() {
        throw new SignatureProviderError("files not ready");
      },
    });
    await expect(
      handleProviderEvent({
        store,
        provider,
        event: webhook("downloadable"),
      }),
    ).rejects.toThrow(/files not ready/i);
    expect(store.requests[0].status).toBe("signed");
    expect(store.requests[0].lastError).toMatch(/files not ready/i);
    expect(store.documents).toHaveLength(0);
    expect(store.agreementStatus).toBe("sent");
  });
});

describe("cancel and immutability", () => {
  it("returns a generated agreement after cancel", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    await sendForSignature({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
    });
    await cancelSignatureRequest({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
    });
    expect(store.requests[0].status).toBe("cancelled");
    expect(store.agreementStatus).toBe("generated");
  });

  it("refuses to insert a second signed document for the same request", async () => {
    const store = memoryStore();
    await sendForSignature({
      store,
      provider: mockProvider(),
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
    });
    const provider = mockProvider();
    await handleProviderEvent({ store, provider, event: webhook("downloadable") });
    await expect(
      store.insertSignedDocument({
        firmId: FIRM,
        costsAgreementId: AGREEMENT,
        agreementVersionId: VERSION,
        signatureRequestId: "req-1",
        storagePath: "other.pdf",
        sha256: "a".repeat(64),
        pageCount: 1,
        byteSize: 10,
        signedAt: "2026-09-21T00:00:00.000Z",
      }),
    ).rejects.toThrow(/immutable/i);
  });
});

describe("status transitions", () => {
  it("does not treat generated as sent after a provider failure", async () => {
    const statuses: AgreementStatus[] = [];
    const store = memoryStore();
    const original = store.updateAgreementStatus;
    store.updateAgreementStatus = async (firmId, agreementId, status, allowedFrom) => {
      statuses.push(status);
      return original(firmId, agreementId, status, allowedFrom);
    };
    await expect(
      sendForSignature({
        store,
        provider: mockProvider({
          async createSignatureRequest() {
            throw new SignatureProviderError("boom");
          },
        }),
        firmId: FIRM,
        agreementId: AGREEMENT,
        actorUserId: USER,
        signer: { name: "John Smith", email: "john@example.com" },
        testMode: false,
      }),
    ).rejects.toThrow(/boom/);
    expect(statuses).toEqual([]);
    expect(store.agreementStatus).toBe("generated");
  });
});
