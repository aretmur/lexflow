import { describe, expect, it } from "vitest";
import { EMAIL_SEND_FAILED, EmailProviderError } from "@/lib/email/errors";
import { createMsalTokenProvider, type MsalConfidentialClient } from "@/lib/email/graph-auth";

describe("Microsoft Graph client-credential tokens", () => {
  it("acquires an application token for the Graph default scope", async () => {
    const captured: { scopes?: string[] } = {};
    const client: MsalConfidentialClient = {
      async acquireTokenByClientCredential(request) {
        captured.scopes = request.scopes;
        return { accessToken: "graph-access-token" };
      },
    };
    const tokens = createMsalTokenProvider({
      tenantId: "tenant-id",
      clientId: "client-id",
      clientSecret: "client-secret",
      client,
    });
    await expect(tokens.getAccessToken()).resolves.toBe("graph-access-token");
    expect(captured.scopes).toEqual(["https://graph.microsoft.com/.default"]);
  });

  it("does not expose the access token on failure", async () => {
    const client: MsalConfidentialClient = {
      async acquireTokenByClientCredential() {
        throw new Error("invalid_client client-secret leaked");
      },
    };
    const tokens = createMsalTokenProvider({
      tenantId: "tenant-id",
      clientId: "client-id",
      clientSecret: "client-secret",
      client,
    });
    try {
      await tokens.getAccessToken();
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(EmailProviderError);
      expect(String(error)).toBe(`EmailProviderError: ${EMAIL_SEND_FAILED}`);
      expect(String(error)).not.toContain("client-secret");
      expect(String(error)).not.toContain("invalid_client");
    }
  });
});
