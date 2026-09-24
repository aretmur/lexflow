import { afterEach, describe, expect, it } from "vitest";
import {
  EMAIL_SEND_FAILED,
  EMAIL_SENDER_NOT_AUTHORISED,
  MICROSOFT_EMAIL_NOT_CONFIGURED,
  EmailProviderError,
} from "@/lib/email/errors";
import { MicrosoftGraphEmailProvider, type GraphFetch } from "@/lib/email/graph";
import type { GraphTokenProvider } from "@/lib/email/graph-auth";

const sender = "intake@octagonlegal.au";

const original = {
  tenant: process.env.MICROSOFT_TENANT_ID,
  client: process.env.MICROSOFT_CLIENT_ID,
  secret: process.env.MICROSOFT_CLIENT_SECRET,
  sender: process.env.MICROSOFT_GRAPH_SENDER,
};

afterEach(() => {
  restore("MICROSOFT_TENANT_ID", original.tenant);
  restore("MICROSOFT_CLIENT_ID", original.client);
  restore("MICROSOFT_CLIENT_SECRET", original.secret);
  restore("MICROSOFT_GRAPH_SENDER", original.sender);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function setGraphEnv() {
  process.env.MICROSOFT_TENANT_ID = "tenant-id";
  process.env.MICROSOFT_CLIENT_ID = "client-id";
  process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
  process.env.MICROSOFT_GRAPH_SENDER = sender;
}

function tokens(token = "access-token"): GraphTokenProvider {
  return {
    async getAccessToken() {
      return token;
    },
  };
}

function graphFetch(
  impl: GraphFetch,
): GraphFetch {
  return impl;
}

function jsonResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe("Microsoft Graph email provider", () => {
  it("fails when tenant id is missing", () => {
    setGraphEnv();
    delete process.env.MICROSOFT_TENANT_ID;
    expect(() => MicrosoftGraphEmailProvider.fromEnv({ tokens: tokens() })).toThrow(
      MICROSOFT_EMAIL_NOT_CONFIGURED,
    );
  });

  it("fails when client id is missing", () => {
    setGraphEnv();
    delete process.env.MICROSOFT_CLIENT_ID;
    expect(() => MicrosoftGraphEmailProvider.fromEnv({ tokens: tokens() })).toThrow(
      MICROSOFT_EMAIL_NOT_CONFIGURED,
    );
  });

  it("fails when client secret is missing", () => {
    setGraphEnv();
    delete process.env.MICROSOFT_CLIENT_SECRET;
    expect(() => MicrosoftGraphEmailProvider.fromEnv({ tokens: tokens() })).toThrow(
      MICROSOFT_EMAIL_NOT_CONFIGURED,
    );
  });

  it("fails when sender is missing", () => {
    setGraphEnv();
    delete process.env.MICROSOFT_GRAPH_SENDER;
    expect(() => MicrosoftGraphEmailProvider.fromEnv({ tokens: tokens() })).toThrow(
      MICROSOFT_EMAIL_NOT_CONFIGURED,
    );
  });

  it("posts to /users/{sender}/sendMail and never /me/sendMail", async () => {
    const captured: { url?: string; init?: Parameters<GraphFetch>[1] } = {};
    const provider = new MicrosoftGraphEmailProvider(
      sender,
      tokens(),
      graphFetch(async (url, init) => {
        captured.url = url;
        captured.init = init;
        return jsonResponse(202);
      }),
    );

    const result = await provider.send({
      to: "aret@example.com",
      from: sender,
      replyTo: sender,
      subject: "Please review and sign your costs agreement",
      text: "Hi Aret,\n\nhttp://localhost:3000/sign/abc\n",
    });

    expect(result).toEqual({ provider: "microsoft_graph", messageId: null });
    expect(captured.url).toBe(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    );
    expect(captured.url).not.toMatch(/\/me\/sendMail/i);
    expect(captured.init?.headers.Authorization).toBe("Bearer access-token");
    expect(captured.init?.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(captured.init?.body ?? "{}")).toEqual({
      message: {
        subject: "Please review and sign your costs agreement",
        body: {
          contentType: "Text",
          content: "Hi Aret,\n\nhttp://localhost:3000/sign/abc\n",
        },
        toRecipients: [{ emailAddress: { address: "aret@example.com" } }],
        replyTo: [{ emailAddress: { address: sender } }],
      },
      saveToSentItems: true,
    });
  });

  it("sends a PDF as a Graph fileAttachment with base64 contentBytes", async () => {
    const captured: { body?: string } = {};
    const provider = new MicrosoftGraphEmailProvider(
      sender,
      tokens(),
      graphFetch(async (_url, init) => {
        captured.body = init.body;
        return jsonResponse(202);
      }),
    );
    const bytes = new Uint8Array([37, 80, 68, 70]);
    await provider.send({
      to: "client@example.com",
      from: sender,
      subject: "Your signed costs agreement",
      text: "Attached.",
      attachments: [
        {
          filename: "Signed Costs Agreement.pdf",
          contentType: "application/pdf",
          bytes,
        },
      ],
    });
    expect(JSON.parse(captured.body ?? "{}").message.attachments).toEqual([
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: "Signed Costs Agreement.pdf",
        contentType: "application/pdf",
        contentBytes: Buffer.from(bytes).toString("base64"),
      },
    ]);
  });

  it("uses MICROSOFT_GRAPH_SENDER as reply-to when none is provided", async () => {
    const captured: { body?: string } = {};
    const provider = new MicrosoftGraphEmailProvider(
      sender,
      tokens(),
      graphFetch(async (_url, init) => {
        captured.body = init.body;
        return jsonResponse(202);
      }),
    );
    await provider.send({
      to: "client@example.com",
      subject: "Your Lexflow verification code",
      text: "123456",
    });
    expect(JSON.parse(captured.body ?? "{}").message.replyTo[0].emailAddress.address).toBe(sender);
  });

  it("does not impersonate a different firm mailbox", async () => {
    const provider = new MicrosoftGraphEmailProvider(sender, tokens(), graphFetch(async () => jsonResponse(202)));
    await expect(
      provider.send({
        to: "client@example.com",
        from: "otherfirm@example.com",
        subject: "x",
        text: "y",
      }),
    ).rejects.toThrow(EMAIL_SENDER_NOT_AUTHORISED);
  });

    it.each([401, 403, 404, 429, 500, 503])("handles Graph %s with a safe client error", async (status) => {
    const provider = new MicrosoftGraphEmailProvider(
      sender,
      tokens("secret-access-token-value"),
      graphFetch(async () =>
        jsonResponse(
          status,
          { error: { code: "ErrorAccessDenied", message: "secret-access-token-value" } },
          { "request-id": "corr-1" },
        ),
      ),
    );
    try {
      await provider.send({ to: "a@b.c", subject: "x", text: "y" });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(EmailProviderError);
      expect(String(error)).toContain(EMAIL_SEND_FAILED);
      expect(String(error)).not.toContain("secret-access-token-value");
      expect(String(error)).not.toContain("ErrorAccessDenied");
    }
  });
});
