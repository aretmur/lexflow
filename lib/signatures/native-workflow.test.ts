import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { ConsoleEmailProvider, setEmailProviderForTests } from "@/lib/email/provider";
import { EMAIL_SEND_FAILED, EMAIL_SENDER_NOT_AUTHORISED, EmailProviderError } from "@/lib/email/errors";
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/types";
import { CONSENT_TEXT_VERSION, consentText } from "@/lib/signatures/consent";
import { NativeLexflowProvider } from "@/lib/signatures/native";
import {
  completeNativeSigning,
  LEGACY_PACK_SIGNING_ERROR,
  resolveNativeSigningSession,
  sendNativeSigningOtp,
  startNativeSigning,
  resendNativeSigningLink,
  verifyNativeSigningOtp,
} from "@/lib/signatures/native-workflow";
import { resetRateLimitsForTests } from "@/lib/signatures/rate-limit";
import { cancelSignatureRequest } from "@/lib/signatures/workflow";
import { SignatureWorkflowError } from "@/lib/signatures/types";
import {
  AGREEMENT,
  FIRM,
  OTHER_FIRM,
  USER,
  memoryStore,
} from "@/lib/signatures/test-memory-store";

const nativeProvider = new NativeLexflowProvider();
const now = new Date("2026-09-21T00:00:00.000Z");
let packBytes = new Uint8Array([37, 80, 68, 70]);
const originalGraphSender = process.env.MICROSOFT_GRAPH_SENDER;

beforeAll(async () => {
  const document = await PDFDocument.create();
  document.addPage();
  packBytes = new Uint8Array(await document.save());
});

function createStore() {
  return memoryStore({ packBytes });
}

function startInput(
  store: ReturnType<typeof memoryStore>,
  extras: Partial<Parameters<typeof startNativeSigning>[0]> = {},
) {
  return {
    store,
    provider: nativeProvider,
    firmId: FIRM,
    firmName: "Example Law",
    agreementId: AGREEMENT,
    actorUserId: USER,
    signer: { name: "John Smith", email: "john@example.com" },
    testMode: true,
    signingMode: "qr" as const,
    now,
    ...extras,
  };
}

async function completeInput(
  store: ReturnType<typeof memoryStore>,
  token: string,
  extras: Partial<Parameters<typeof completeNativeSigning>[0]> = {},
) {
  const result = await completeNativeSigning({
    store,
    token,
    consentAccepted: true,
    signerName: "John Smith",
    signedDate: "21 September 2026",
    signerCapacity: "Client",
    signature: { kind: "type", text: "John Smith" },
    initials: { kind: "type", text: "JS" },
    initialledPages: [1],
    now,
    ...extras,
  });
  return result.signed;
}

describe("native Lexflow signing", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    setEmailProviderForTests(new ConsoleEmailProvider());
  });

  afterEach(() => {
    setEmailProviderForTests(null);
    if (originalGraphSender === undefined) {
      delete process.env.MICROSOFT_GRAPH_SENDER;
    } else {
      process.env.MICROSOFT_GRAPH_SENDER = originalGraphSender;
    }
  });

  it("stores a hashed token and never emails a QR session until the signed copies go out", async () => {
    const store = createStore();
    const email = new RecordingEmailProvider();
    setEmailProviderForTests(email);
    const started = await startNativeSigning(startInput(store));

    expect(started.request.provider).toBe("native_lexflow");
    expect(started.request.signingMode).toBe("qr");
    expect(started.request.signingTokenHash).toBeTruthy();
    expect(started.request.signingTokenHash).not.toBe(started.token);
    expect(JSON.stringify(store.requests[0])).not.toContain(started.token);
    expect(started.request.emailVerifiedAt).toBeTruthy();
    expect(started.request.initiatedByUserId).toBe(USER);
    expect(email.sent).toHaveLength(0);
    await completeInput(store, started.token);
    expect(store.requests[0].status).toBe("signed");
    expect(email.sent).toHaveLength(2);
    expect(email.sent.map((item) => item.to).sort()).toEqual([
      "intake@example.com",
      "john@example.com",
    ]);
    expect(email.sent.every((item) => item.attachments?.[0]?.filename === "Signed Costs Agreement.pdf")).toBe(
      true,
    );
  });

  it("emails a signing link and requires OTP before the pack can be reviewed", async () => {
    const store = createStore();
    const email = new ConsoleEmailProvider();
    setEmailProviderForTests(email);
    const started = await startNativeSigning(startInput(store, { signingMode: "email" }));
    expect(email.sent[0]?.text).toContain(started.signingUrl);
    expect(email.sent[0]?.text).toContain("Example Law has prepared a costs agreement");
    expect(email.sent[0]?.text).not.toMatch(/assault|GST|disbursement/i);

    const beforeOtp = await resolveNativeSigningSession({ store, token: started.token, now });
    expect(beforeOtp.status).toBe("needs_otp");

    await sendNativeSigningOtp({ store, token: started.token, now });
    const otp = email.sent.at(-1);
    const code = otp?.text.match(/\b(\d{6})\b/)?.[1];
    expect(otp?.subject).toBe("Your Lexflow verification code");
    expect(code).toMatch(/^\d{6}$/);
    expect(otp?.text).toContain(code!);
    expect(otp?.text).not.toMatch(/assault|theft|GST|disbursement|instruction/i);
    expect(store.requests[0].otpHash).not.toBe(code);

    await verifyNativeSigningOtp({ store, token: started.token, code: code!, now });
    const ready = await resolveNativeSigningSession({ store, token: started.token, now });
    expect(ready.status).toBe("ready");
    if (ready.status === "ready") {
      expect(ready.consentText).toBe(consentText("John Smith"));
      expect(ready.consentTextVersion).toBe(CONSENT_TEXT_VERSION);
    }
  });

  it("records same-device initiation without email OTP by default", async () => {
    const store = createStore();
    const email = new RecordingEmailProvider();
    setEmailProviderForTests(email);
    const started = await startNativeSigning(startInput(store, { signingMode: "same_device" }));
    const session = await resolveNativeSigningSession({ store, token: started.token, now });
    expect(session.status).toBe("ready");
    expect(email.sent).toHaveLength(0);
    await completeInput(store, started.token);
    expect(store.requests[0].status).toBe("signed");
    expect(email.sent).toHaveLength(2);
  });

  it("can require email OTP for QR sessions", async () => {
    const store = createStore();
    const started = await startNativeSigning(
      startInput(store, { requireEmailOtpForQr: true }),
    );
    const session = await resolveNativeSigningSession({ store, token: started.token, now });
    expect(session.status).toBe("needs_otp");
  });

  it("stamps an executed PDF, verifies the source hash, and keeps the generated pack", async () => {
    const store = createStore();
    const started = await startNativeSigning(startInput(store, { requirePageInitials: true }));
    const sourceHash = sha256Hex((await store.downloadGeneratedPack("path"))!);
    const signed = await completeInput(store, started.token);

    expect(signed.sha256).toHaveLength(64);
    expect(signed.sha256).not.toBe(sourceHash);
    expect(store.uploads[0]).toContain("signed-agreement.pdf");
    expect(sha256Hex((await store.downloadGeneratedPack("path"))!)).toBe(sourceHash);
    expect(store.requests[0].status).toBe("signed");
    expect(store.requests[0].consentTextVersion).toBe(CONSENT_TEXT_VERSION);
    expect(store.agreementStatus).toBe("signed");
  });

  it("rejects completion without consent and is idempotent after a stored signed PDF", async () => {
    const store = createStore();
    const started = await startNativeSigning(startInput(store));
    await expect(
      completeInput(store, started.token, { consentAccepted: false }),
    ).rejects.toBeInstanceOf(SignatureWorkflowError);

    const first = await completeInput(store, started.token);
    const second = await completeInput(store, started.token);
    expect(second.id).toBe(first.id);
    expect(store.documents).toHaveLength(1);
    expect(store.uploads).toHaveLength(1);
    expect(store.deliveries.filter((row) => row.status === "sent")).toHaveLength(2);
  });

  it("invalidates the token after cancel", async () => {
    const store = createStore();
    const started = await startNativeSigning(startInput(store));
    await cancelSignatureRequest({
      store,
      provider: nativeProvider,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      now,
    });
    const session = await resolveNativeSigningSession({ store, token: started.token, now });
    expect(session.status).toBe("invalid");
    expect(store.requests[0].status).toBe("cancelled");
  });

  it("does not load another firm's agreement", async () => {
    const store = createStore();
    await expect(
      startNativeSigning(startInput(store, { firmId: OTHER_FIRM })),
    ).rejects.toBeInstanceOf(SignatureWorkflowError);
  });

  it("preserves null page-split metadata on a legacy generated pack", async () => {
    const store = memoryStore({
      packBytes,
      agreementPageCount: null,
      attachmentPageCount: null,
    });
    const context = await store.loadSendContext(FIRM, AGREEMENT);
    expect(context?.agreementPageCount).toBeNull();
    expect(context?.attachmentPageCount).toBeNull();
    expect(context?.packPageCount).toBe(1);
  });

  it("refuses native signing for a legacy pack rather than guessing the execution page", async () => {
    const store = memoryStore({
      packBytes,
      packPageCount: 5,
      agreementPageCount: null,
      attachmentPageCount: null,
    });
    await expect(startNativeSigning(startInput(store))).rejects.toThrow(LEGACY_PACK_SIGNING_ERROR);
    expect(store.requests).toHaveLength(0);
    expect(store.agreementStatus).toBe("generated");
  });

  it("records the execution page from agreement_page_count, not the total pack page count", async () => {
    const document = await PDFDocument.create();
    for (let index = 0; index < 5; index += 1) {
      document.addPage();
    }
    const pages = new Uint8Array(await document.save());
    const store = memoryStore({
      packBytes: pages,
      packPageCount: 5,
      agreementPageCount: 3,
      attachmentPageCount: 2,
    });
    const started = await startNativeSigning(startInput(store));
    expect(started.request.agreementPageCount).toBe(3);
    expect(started.request.pageCount).toBe(5);
    expect(started.request.executionPage).toBe(3);
    expect(started.request.executionPage).not.toBe(5);
  });

  it("does not report Sent when email delivery fails and can retry the same request", async () => {
    const store = createStore();
    setEmailProviderForTests(new FailingEmailProvider());
    await expect(
      startNativeSigning(startInput(store, { signingMode: "email", firmName: "Octagon Legal" })),
    ).rejects.toThrow(EMAIL_SEND_FAILED);
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0].sentAt).toBeNull();
    expect(store.requests[0].emailSentAt).toBeNull();
    expect(store.requests[0].lastError).toBe(EMAIL_SEND_FAILED);
    expect(store.agreementStatus).toBe("sent");

    const recording = new RecordingEmailProvider();
    setEmailProviderForTests(recording);
    await resendNativeSigningLink({
      store,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      firmName: "Octagon Legal",
      now,
    });
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0].emailSentAt).toBeTruthy();
    expect(store.requests[0].emailProvider).toBe("resend");
    expect(store.requests[0].emailMessageId).toBe("msg_retry");
    expect(store.requests[0].lastError).toBeNull();
    expect(recording.sent[0]?.text).toContain("Octagon Legal has prepared a costs agreement");
  });

  it("records Microsoft Graph acceptance without a message id", async () => {
    const store = createStore();
    process.env.MICROSOFT_GRAPH_SENDER = "intake@octagonlegal.au";
    setEmailProviderForTests(new GraphAcceptingProvider());
    await startNativeSigning(
      startInput(store, {
        signingMode: "email",
        firmName: "Octagon Legal",
        emailFrom: "intake@octagonlegal.au",
        emailReplyTo: "intake@octagonlegal.au",
      }),
    );
    expect(store.requests[0].emailProvider).toBe("microsoft_graph");
    expect(store.requests[0].emailMessageId).toBeNull();
    expect(store.requests[0].emailSentAt).toBeTruthy();
    expect(store.requests[0].sentAt).toBeTruthy();
  });

  it("does not mark Sent when Graph sending fails and can retry the same request", async () => {
    const store = createStore();
    process.env.MICROSOFT_GRAPH_SENDER = "intake@octagonlegal.au";
    setEmailProviderForTests(new GraphFailingProvider());
    await expect(
      startNativeSigning(
        startInput(store, {
          signingMode: "email",
          firmName: "Octagon Legal",
          emailFrom: "intake@octagonlegal.au",
        }),
      ),
    ).rejects.toThrow(EMAIL_SEND_FAILED);
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0].emailSentAt).toBeNull();
    expect(store.requests[0].lastError).toBe(EMAIL_SEND_FAILED);

    setEmailProviderForTests(new GraphAcceptingProvider());
    await resendNativeSigningLink({
      store,
      firmId: FIRM,
      agreementId: AGREEMENT,
      actorUserId: USER,
      firmName: "Octagon Legal",
      emailFrom: "intake@octagonlegal.au",
      now,
    });
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0].emailProvider).toBe("microsoft_graph");
    expect(store.requests[0].emailMessageId).toBeNull();
    expect(store.requests[0].emailSentAt).toBeTruthy();
    expect(store.requests[0].lastError).toBeNull();
  });

  it("keeps the agreement signed when signed-copy email fails", async () => {
    const store = createStore();
    const started = await startNativeSigning(startInput(store));
    setEmailProviderForTests(new FailingEmailProvider());
    await completeInput(store, started.token);
    expect(store.requests[0].status).toBe("signed");
    expect(store.agreementStatus).toBe("signed");
    expect(store.documents).toHaveLength(1);
    expect(store.deliveries.every((row) => row.status === "failed")).toBe(true);
  });

  it("does not send through another firm's mailbox", async () => {
    const store = createStore();
    process.env.MICROSOFT_GRAPH_SENDER = "intake@octagonlegal.au";
    const graph = new GraphAcceptingProvider();
    setEmailProviderForTests(graph);
    await expect(
      startNativeSigning(
        startInput(store, {
          signingMode: "email",
          emailFrom: "otherfirm@example.com",
        }),
      ),
    ).rejects.toThrow(EMAIL_SENDER_NOT_AUTHORISED);
    expect(graph.calls).toBe(0);
    expect(store.requests[0].emailSentAt).toBeNull();
  });
});

class FailingEmailProvider implements EmailProvider {
  readonly name = "fail";
  async send(): Promise<EmailSendResult> {
    throw new EmailProviderError(EMAIL_SEND_FAILED);
  }
}

class RecordingEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    return { provider: this.name, messageId: "msg_retry" };
  }
}

class GraphAcceptingProvider implements EmailProvider {
  readonly name = "microsoft_graph";
  calls = 0;
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.calls += 1;
    this.sent.push(message);
    return { provider: this.name, messageId: null };
  }
}

class GraphFailingProvider implements EmailProvider {
  readonly name = "microsoft_graph";
  async send(): Promise<EmailSendResult> {
    throw new EmailProviderError(EMAIL_SEND_FAILED);
  }
}
