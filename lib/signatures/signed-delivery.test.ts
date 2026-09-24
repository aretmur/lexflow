import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  FIRM_SIGNED_COPY_EMAIL_MISSING,
  SIGNED_PDF_TOO_LARGE,
} from "@/lib/email/errors";
import { ConsoleEmailProvider, setEmailProviderForTests } from "@/lib/email/provider";
import {
  canAttachSignedPdf,
  deliverSignedAgreementCopies,
  GRAPH_DIRECT_ATTACHMENT_MAX_BYTES,
  retrySignedDocumentDelivery,
} from "@/lib/signatures/signed-delivery";
import { AGREEMENT, FIRM, USER, memoryStore } from "@/lib/signatures/test-memory-store";

async function pdfBytes() {
  const document = await PDFDocument.create();
  document.addPage();
  return new Uint8Array(await document.save());
}

function requestAndSigned(store: ReturnType<typeof memoryStore>) {
  return Promise.all([
    store.insertRequest({
      firmId: FIRM,
      costsAgreementId: AGREEMENT,
      agreementVersionId: "44444444-4444-4444-4444-444444444444",
      generatedPackId: "55555555-5555-5555-5555-555555555555",
      provider: "native_lexflow",
      providerRequestId: "native_1",
      signerName: "John Smith",
      signerEmail: "john@example.com",
      status: "signed",
      testMode: false,
      sentAt: new Date().toISOString(),
      createdBy: USER,
      requirePageInitials: false,
      initialsFieldCount: 0,
      pageCount: 1,
      signingMode: "qr",
    }),
    store.insertSignedDocument({
      firmId: FIRM,
      costsAgreementId: AGREEMENT,
      agreementVersionId: "44444444-4444-4444-4444-444444444444",
      signatureRequestId: "pending",
      storagePath: `${FIRM}/${AGREEMENT}/signed-agreement.pdf`,
      sha256: "a".repeat(64),
      pageCount: 1,
      byteSize: 100,
      signedAt: new Date().toISOString(),
    }),
  ]).then(async ([request]) => {
    const signed = store.documents[0];
    signed.signatureRequestId = request.id;
    await store.uploadSignedPdf(signed.storagePath, await pdfBytes());
    return { request, signed };
  });
}

describe("signed agreement copy delivery", () => {
  it("caps Graph-style direct attachments at 2.5MB", () => {
    expect(canAttachSignedPdf(0)).toBe(false);
    expect(canAttachSignedPdf(GRAPH_DIRECT_ATTACHMENT_MAX_BYTES)).toBe(true);
    expect(canAttachSignedPdf(GRAPH_DIRECT_ATTACHMENT_MAX_BYTES + 1)).toBe(false);
  });

  it("emails client and firm copies once", async () => {
    const store = memoryStore();
    const email = new ConsoleEmailProvider();
    setEmailProviderForTests(email);
    const { request, signed } = await requestAndSigned(store);
    const bytes = (await store.downloadSignedPdf(signed.storagePath))!;
    await deliverSignedAgreementCopies({ store, request, signed, pdfBytes: bytes });
    await deliverSignedAgreementCopies({ store, request, signed, pdfBytes: bytes });
    expect(email.sent).toHaveLength(2);
    expect(store.deliveries.map((row) => row.status)).toEqual(["sent", "sent"]);
    setEmailProviderForTests(null);
  });

  it("records a missing firm mailbox without blocking the client copy", async () => {
    const store = memoryStore({
      signingContact: {
        displayName: "Example Law",
        senderEmail: null,
        replyTo: null,
      },
    });
    const email = new ConsoleEmailProvider();
    setEmailProviderForTests(email);
    const { request, signed } = await requestAndSigned(store);
    await deliverSignedAgreementCopies({
      store,
      request,
      signed,
      pdfBytes: (await store.downloadSignedPdf(signed.storagePath))!,
    });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe("john@example.com");
    expect(store.deliveries.find((row) => row.recipientRole === "firm")?.lastError).toBe(
      FIRM_SIGNED_COPY_EMAIL_MISSING,
    );
    expect(store.deliveries.find((row) => row.recipientRole === "client")?.status).toBe("sent");
    setEmailProviderForTests(null);
  });

  it("does not attach an oversized signed PDF", async () => {
    const store = memoryStore();
    const email = new ConsoleEmailProvider();
    setEmailProviderForTests(email);
    const { request, signed } = await requestAndSigned(store);
    const oversized = new Uint8Array(GRAPH_DIRECT_ATTACHMENT_MAX_BYTES + 1);
    await deliverSignedAgreementCopies({ store, request, signed, pdfBytes: oversized });
    expect(email.sent).toHaveLength(0);
    expect(store.deliveries.every((row) => row.lastError === SIGNED_PDF_TOO_LARGE)).toBe(true);
    setEmailProviderForTests(null);
  });

  it("retries a failed recipient only", async () => {
    const store = memoryStore();
    setEmailProviderForTests({
      name: "console",
      async send(message) {
        if (message.to === "john@example.com") {
          throw new Error("nope");
        }
        return { provider: "console", messageId: null };
      },
    });
    const { request, signed } = await requestAndSigned(store);
    await deliverSignedAgreementCopies({
      store,
      request,
      signed,
      pdfBytes: (await store.downloadSignedPdf(signed.storagePath))!,
    });
    expect(store.deliveries.find((row) => row.recipientRole === "client")?.status).toBe("failed");
    expect(store.deliveries.find((row) => row.recipientRole === "firm")?.status).toBe("sent");

    const email = new ConsoleEmailProvider();
    setEmailProviderForTests(email);
    await retrySignedDocumentDelivery({
      store,
      firmId: FIRM,
      agreementId: AGREEMENT,
      recipientRole: "client",
      actorUserId: USER,
    });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe("john@example.com");
    expect(store.deliveries.find((row) => row.recipientRole === "client")?.status).toBe("sent");
    expect(store.deliveries.find((row) => row.recipientRole === "firm")?.attemptCount).toBe(1);
    setEmailProviderForTests(null);
  });
});
