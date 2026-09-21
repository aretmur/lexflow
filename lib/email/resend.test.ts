import { describe, expect, it } from "vitest";
import { EMAIL_SEND_FAILED, EmailProviderError } from "@/lib/email/errors";
import { ResendEmailProvider, type ResendClient } from "@/lib/email/resend";

function fakeClient(
  impl: ResendClient["emails"]["send"],
): ResendClient {
  return { emails: { send: impl } };
}

describe("Resend email provider", () => {
  it("sends to the recipient from EMAIL_FROM with reply-to", async () => {
    let payload: Parameters<ResendClient["emails"]["send"]>[0] | null = null;
    const provider = new ResendEmailProvider(
      "Octagon Legal <intake@octagonlegal.au>",
      "intake@octagonlegal.au",
      fakeClient(async (input) => {
        payload = input;
        return { data: { id: "msg_123" }, error: null };
      }),
    );

    const result = await provider.send({
      to: "aret@example.com",
      subject: "Please review and sign your costs agreement",
      text: "Hi Aret,\n\nOpen http://localhost:3000/sign/token",
    });

    expect(result).toEqual({ provider: "resend", messageId: "msg_123" });
    expect(payload).toMatchObject({
      from: "Octagon Legal <intake@octagonlegal.au>",
      to: "aret@example.com",
      replyTo: "intake@octagonlegal.au",
    });
  });

  it("prefers the message reply-to over the env default", async () => {
    const captured: { payload?: Parameters<ResendClient["emails"]["send"]>[0] } = {};
    const provider = new ResendEmailProvider(
      "Lexflow <noreply@lexflow.com.au>",
      "noreply@lexflow.com.au",
      fakeClient(async (input) => {
        captured.payload = input;
        return { data: { id: "msg_456" }, error: null };
      }),
    );
    await provider.send({
      to: "client@example.com",
      subject: "Code",
      text: "123456",
      replyTo: "intake@octagonlegal.au",
    });
    expect(captured.payload?.replyTo).toBe("intake@octagonlegal.au");
  });

  it("returns a safe error and does not include the API key", async () => {
    const provider = new ResendEmailProvider(
      "Octagon Legal <intake@octagonlegal.au>",
      undefined,
      fakeClient(async () => {
        throw new Error("Unauthorized re_live_secret_key_value");
      }),
    );
    await expect(provider.send({ to: "a@b.c", subject: "x", text: "y" })).rejects.toBeInstanceOf(
      EmailProviderError,
    );
    await expect(provider.send({ to: "a@b.c", subject: "x", text: "y" })).rejects.toThrow(
      EMAIL_SEND_FAILED,
    );
    try {
      await provider.send({ to: "a@b.c", subject: "x", text: "y" });
    } catch (error) {
      expect(String(error)).not.toContain("re_live_secret_key_value");
      expect(String(error)).not.toContain("Unauthorized");
    }
  });
});
