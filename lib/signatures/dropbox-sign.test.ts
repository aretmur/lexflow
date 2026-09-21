import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DropboxSignProvider } from "@/lib/signatures/dropbox-sign";
import { SIGNING_EMAIL_SUBJECT } from "@/lib/signatures/text-tags";
import { SignatureProviderError } from "@/lib/signatures/types";

const API_KEY = "test-api-key";

function provider(fetchImpl: typeof fetch) {
  return new DropboxSignProvider(
    {
      apiKey: API_KEY,
      clientId: "client-1",
      testMode: true,
      apiBaseUrl: "https://api.hellosign.com/v3",
    },
    fetchImpl,
  );
}

function eventHash(time: string, type: string) {
  return createHmac("sha256", API_KEY).update(`${time}${type}`).digest("hex");
}

describe("Dropbox Sign webhook verification", () => {
  it("accepts a valid event hash and rejects a tampered hash", () => {
    const sign = provider(fetch);
    const eventTime = "1695270000";
    const eventType = "signature_request_sent";
    expect(
      sign.verifyWebhook({
        eventTime,
        eventType,
        eventHash: eventHash(eventTime, eventType),
      }),
    ).toBe(true);
    expect(
      sign.verifyWebhook({
        eventTime,
        eventType,
        eventHash: "0".repeat(64),
      }),
    ).toBe(false);
  });

  it("maps provider events including sent, viewed, completed, declined and errors", () => {
    const sign = provider(fetch);
    expect(
      sign.parseWebhook({
        event: {
          event_type: "signature_request_sent",
          event_time: "1695270000",
          event_hash: "abc",
        },
        signature_request: { signature_request_id: "sr-1" },
      }).eventType,
    ).toBe("sent");
    expect(
      sign.parseWebhook({
        event: {
          event_type: "signature_request_viewed",
          event_time: "1695270001",
          event_hash: "def",
        },
        signature_request: { signature_request_id: "sr-1" },
      }).eventType,
    ).toBe("viewed");
    expect(
      sign.parseWebhook({
        event: {
          event_type: "signature_request_downloadable",
          event_time: "1695270002",
          event_hash: "ghi",
        },
        signature_request: { signature_request_id: "sr-1" },
      }).eventType,
    ).toBe("downloadable");
    expect(
      sign.parseWebhook({
        event: {
          event_type: "signature_request_declined",
          event_time: "1695270003",
          event_hash: "jkl",
        },
        signature_request: { signature_request_id: "sr-1" },
      }).eventType,
    ).toBe("declined");
    expect(
      sign.parseWebhook({
        event: {
          event_type: "signature_request_canceled",
          event_time: "1695270004",
          event_hash: "mno",
        },
        signature_request: { signature_request_id: "sr-1" },
      }).eventType,
    ).toBe("cancelled");
    expect(
      sign.parseWebhook({
        event: {
          event_type: "signature_request_invalid",
          event_time: "1695270005",
          event_hash: "pqr",
        },
        signature_request: { signature_request_id: "sr-1" },
      }).eventType,
    ).toBe("failed");
  });
});

describe("Dropbox Sign send request", () => {
  it("sends signer metadata, text-tag flags and the generated pack", async () => {
    const calls: Request[] = [];
    const sign = provider(async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      return Response.json({
        signature_request: { signature_request_id: "sr-created" },
      });
    });

    const result = await sign.createSignatureRequest({
      title: "Costs agreement",
      subject: SIGNING_EMAIL_SUBJECT,
      fileName: "agreement-pack-v1.pdf",
      fileBytes: new Uint8Array([1, 2, 3]),
      signer: { name: "John Smith", email: "john@example.com" },
      metadata: { lexflow_agreement_id: "agr-1" },
      signingRedirectUrl: "https://www.lexflow.com.au/signing-complete",
      testMode: true,
    });

    expect(result.providerRequestId).toBe("sr-created");
    expect(calls).toHaveLength(1);
    const form = await calls[0].formData();
    expect(form.get("subject")).toBe(SIGNING_EMAIL_SUBJECT);
    expect(form.get("signers[0][name]")).toBe("John Smith");
    expect(form.get("signers[0][email_address]")).toBe("john@example.com");
    expect(form.get("use_text_tags")).toBe("1");
    expect(form.get("hide_text_tags")).toBe("0");
    expect(form.get("test_mode")).toBe("1");
    expect(form.get("metadata[lexflow_agreement_id]")).toBe("agr-1");
    expect(form.get("signing_redirect_url")).toBe(
      "https://www.lexflow.com.au/signing-complete",
    );
    expect((form.get("file[0]") as File).name).toBe("agreement-pack-v1.pdf");
  });

  it("surfaces provider failures without inventing a request id", async () => {
    const sign = provider(async () =>
      Response.json(
        { error: { error_msg: "Invalid API key" } },
        { status: 401 },
      ),
    );
    await expect(
      sign.createSignatureRequest({
        title: "Costs agreement",
        subject: SIGNING_EMAIL_SUBJECT,
        fileName: "agreement-pack-v1.pdf",
        fileBytes: new Uint8Array([1]),
        signer: { name: "John Smith", email: "john@example.com" },
        metadata: {},
        signingRedirectUrl: "https://www.lexflow.com.au/signing-complete",
        testMode: true,
      }),
    ).rejects.toBeInstanceOf(SignatureProviderError);
  });
});
