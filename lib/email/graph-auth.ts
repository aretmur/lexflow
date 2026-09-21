import { ConfidentialClientApplication } from "@azure/msal-node";
import { EMAIL_SEND_FAILED, EmailProviderError } from "@/lib/email/errors";
import { logServerError } from "@/lib/server-log";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

export type GraphTokenProvider = {
  getAccessToken(): Promise<string>;
};

export type MsalConfidentialClient = {
  acquireTokenByClientCredential(request: {
    scopes: string[];
  }): Promise<{ accessToken?: string } | null>;
};

const apps = new Map<string, ConfidentialClientApplication>();

export function createMsalTokenProvider(input: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  client?: MsalConfidentialClient;
}): GraphTokenProvider {
  const client =
    input.client ??
    getOrCreateMsalApp(input.tenantId, input.clientId, input.clientSecret);

  return {
    async getAccessToken() {
      try {
        const result = await client.acquireTokenByClientCredential({
          scopes: [GRAPH_SCOPE],
        });
        const token = result?.accessToken?.trim();
        if (!token) {
          logServerError("email_token_failed", {
            provider: "microsoft_graph",
            message: "missing_access_token",
          });
          throw new EmailProviderError(EMAIL_SEND_FAILED);
        }
        return token;
      } catch (error) {
        if (error instanceof EmailProviderError) {
          throw error;
        }
        logServerError("email_token_failed", {
          provider: "microsoft_graph",
          message: error instanceof Error ? error.name : "unknown",
        });
        throw new EmailProviderError(EMAIL_SEND_FAILED);
      }
    },
  };
}

function getOrCreateMsalApp(tenantId: string, clientId: string, clientSecret: string) {
  const key = `${tenantId}:${clientId}`;
  const existing = apps.get(key);
  if (existing) {
    return existing;
  }
  const created = new ConfidentialClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  });
  apps.set(key, created);
  return created;
}

export function resetMsalAppsForTests() {
  apps.clear();
}
