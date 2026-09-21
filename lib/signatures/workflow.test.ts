import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { hashSigningToken } from "@/lib/signatures/signing-token";
import type { SignatureStore } from "@/lib/signatures/store";
import {
  cancelSignatureRequest,
  handleProviderEvent,
  refreshEmbeddedSigningSession,
  resolvePublicSigningSession,
  sendForSignature,
  startEmbeddedSigning,
} from "@/lib/signatures/workflow";
import {
  SignatureProviderError,
  SignatureWorkflowError,
  type CreateSignatureRequestInput,
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

let defaultPackBytes = new Uint8Array([37, 80, 68, 70]);

beforeAll(async () => {
  defaultPackBytes = new Uint8Array(await packPdf(1));
});

async function packPdf(pageCount: number) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }
  return document.save();
}

async function signedPdf() {
  return packPdf(1);
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
  uploadedBytes: Uint8Array[];
} {
  const state = {
    requests: [] as SignatureRequestRecord[],
    documents: [] as SignedAgreementDocumentRecord[],
    events: [] as string[],
    audits: [] as string[],
    agreementStatus: initial?.agreementStatus ?? "generated",
    uploads: [] as string[],
    uploadedBytes: [] as Uint8Array[],
    packBytes: initial?.packBytes ?? defaultPackBytes,
    firmId: initial?.firmId ?? FIRM,
  };

  const store: SignatureStore & {
    requests: SignatureRequestRecord[];
    documents: SignedAgreementDocumentRecord[];
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
        requirePageInitials: input.requirePageInitials,
        initialsFieldCount: input.initialsFieldCount,
        pageCount: input.pageCount,
        signingMode: input.signingMode,
        providerSignatureId: input.providerSignatureId ?? null,
        signingTokenHash: input.signingTokenHash ?? null,
        signingTokenExpiresAt: input.signingTokenExpiresAt ?? null,
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
  embeddedCreated: number;
  cancelled: number;
  downloads: number;
  signUrlCalls: number;
  lastCreate: CreateSignatureRequestInput | null;
  lastSignUrlId: string | null;
} {
  const state = {
    created: 0,
    embeddedCreated: 0,
    cancelled: 0,
    downloads: 0,
    signUrlCalls: 0,
    lastCreate: null as CreateSignatureRequestInput | null,
    lastSignUrlId: null as string | null,
  };
  return {
    name: "dropbox_sign",
    created: 0,
    embeddedCreated: 0,
    cancelled: 0,
    downloads: 0,
    signUrlCalls: 0,
    lastCreate: null,
    lastSignUrlId: null,
    async createSignatureRequest(input) {
      state.created += 1;
      state.lastCreate = input;
      this.created = state.created;
      this.lastCreate = input;
      return { providerRequestId: "sr-1" };
    },
    async createEmbeddedSignatureRequest(input) {
      state.embeddedCreated += 1;
      state.lastCreate = input;
      this.embeddedCreated = state.embeddedCreated;
      this.lastCreate = input;
      return { providerRequestId: "sr-embedded", providerSignatureId: "sig-1" };
    },
    async getEmbeddedSignUrl(providerSignatureId) {
      state.signUrlCalls += 1;
      state.lastSignUrlId = providerSignatureId;
      this.signUrlCalls = state.signUrlCalls;
      this.lastSignUrlId = providerSignatureId;
      return {
        signUrl: `https://app.hellosign.com/editor/embeddedSign?signature_id=${providerSignatureId}&token=temp`,
        expiresAt: "2026-09-21T01:00:00.000Z",
      };
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
    expect(request.signingMode).toBe("email");
    expect(request.requirePageInitials).toBe(true);
    expect(request.pageCount).toBe(1);
    expect(request.initialsFieldCount).toBe(1);
    expect(provider.lastCreate?.formFieldsPerDocument?.[0]).toHaveLength(1);
    expect(provider.lastCreate?.formFieldsPerDocument?.[0][0]).toMatchObject({
      type: "initials",
      required: true,
      signer: 0,
      page: 1,
    });
  });

  it("places an initials field on every page of an 8-page pack", async () => {
    const store = memoryStore({ packBytes: await packPdf(8) });
    const provider = mockProvider();
    const { request } = await sendForSignature({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
    });

    expect(request.pageCount).toBe(8);
    expect(request.initialsFieldCount).toBe(8);
    expect(provider.lastCreate?.formFieldsPerDocument?.[0]).toHaveLength(8);
  });

  it("creates no initials fields when the setting is off", async () => {
    const store = memoryStore({ packBytes: await packPdf(3) });
    const provider = mockProvider();
    const { request } = await sendForSignature({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      requirePageInitials: false,
    });

    expect(request.requirePageInitials).toBe(false);
    expect(request.pageCount).toBe(3);
    expect(request.initialsFieldCount).toBe(0);
    expect(provider.lastCreate?.formFieldsPerDocument).toBeUndefined();
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

  it("stores the completed signed PDF including initials without rewriting it", async () => {
    const store = await sentStore();
    const signed = await PDFDocument.create();
    const page = signed.addPage();
    page.drawText("AB", { x: 500, y: 46, size: 12 });
    const bytes = await signed.save();
    const provider = mockProvider();
    provider.downloadSignedDocument = async () => bytes;

    await handleProviderEvent({
      store,
      provider,
      event: webhook("downloadable", { eventId: "initials-complete" }),
    });

    expect(store.documents[0].sha256).toBe(sha256Hex(bytes));
    expect(store.documents[0].pageCount).toBe(1);
    expect(store.uploadedBytes[0]).toEqual(bytes);
    const stored = await PDFDocument.load(store.uploadedBytes[0]);
    expect(stored.getPageCount()).toBe(1);
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

describe("embedded signing sessions", () => {
  it("creates an embedded request, stores the signature_id, and keeps the sign_url temporary", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    const result = await startEmbeddedSigning({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      signingMode: "embedded_qr",
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    expect(provider.embeddedCreated).toBe(1);
    expect(result.request.providerRequestId).toBe("sr-embedded");
    expect(result.request.providerSignatureId).toBe("sig-1");
    expect(result.request.signingMode).toBe("embedded_qr");
    expect(result.request.signingTokenHash).toBe(hashSigningToken(result.token));
    expect(result.request.signingTokenHash).not.toBe(result.token);
    expect(JSON.stringify(result.request)).not.toContain(result.signingUrl);
    expect(provider.signUrlCalls).toBe(0);
    expect(result.request.initialsFieldCount).toBe(1);
    expect(provider.lastCreate?.formFieldsPerDocument?.[0]).toHaveLength(1);
  });

  it("opens a same-device session and later mints a fresh sign_url", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    const started = await startEmbeddedSigning({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      signingMode: "embedded_same_device",
    });

    const session = await resolvePublicSigningSession({
      store,
      provider,
      token: started.token,
      clientId: "client-1",
    });

    expect(started.request.signingMode).toBe("embedded_same_device");
    expect(session.status).toBe("ready");
    if (session.status === "ready") {
      expect(session.signUrl).toContain("sig-1");
      expect(session.clientId).toBe("client-1");
    }
    expect(provider.lastSignUrlId).toBe("sig-1");
    expect(store.requests[0].status).toBe("viewed");
  });

  it("rejects an expired token and a token from another request", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    const started = await startEmbeddedSigning({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      signingMode: "embedded_qr",
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    await expect(
      resolvePublicSigningSession({
        store,
        provider,
        token: started.token,
        clientId: "client-1",
        now: new Date("2026-09-21T03:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "expired" });

    await expect(
      resolvePublicSigningSession({
        store,
        provider,
        token: "guessed-token",
        clientId: "client-1",
      }),
    ).resolves.toEqual({ status: "invalid" });

    const otherFirm = memoryStore({ firmId: OTHER_FIRM });
    await expect(
      resolvePublicSigningSession({
        store: otherFirm,
        provider,
        token: started.token,
        clientId: "client-1",
      }),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("rotates the Lexflow token without creating another provider request", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    const first = await startEmbeddedSigning({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      signingMode: "embedded_qr",
    });
    const refreshed = await refreshEmbeddedSigningSession({
      store,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
    });

    expect(provider.embeddedCreated).toBe(1);
    expect(refreshed.token).not.toBe(first.token);
    expect(
      await resolvePublicSigningSession({
        store,
        provider,
        token: first.token,
        clientId: "client-1",
      }),
    ).toEqual({ status: "invalid" });
    expect(
      (await resolvePublicSigningSession({
        store,
        provider,
        token: refreshed.token,
        clientId: "client-1",
      })).status,
    ).toBe("ready");
  });

  it("cancels a QR session before creating an email request", async () => {
    const store = memoryStore();
    const provider = mockProvider();
    await startEmbeddedSigning({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      signingMode: "embedded_qr",
    });
    await sendForSignature({
      store,
      provider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      signer: { name: "John Smith", email: "john@example.com" },
      testMode: true,
      replaceActive: true,
    });

    expect(provider.cancelled).toBe(1);
    expect(provider.created).toBe(1);
    expect(store.requests[0].status).toBe("cancelled");
    expect(store.requests[0].signingTokenHash).toBeNull();
    expect(store.requests[1].signingMode).toBe("email");
    expect(store.agreementStatus).toBe("sent");
  });
});
