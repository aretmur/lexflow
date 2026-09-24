import {
  emailsMatch,
  getMicrosoftClientId,
  getMicrosoftClientSecret,
  getMicrosoftGraphSender,
  getMicrosoftTenantId,
} from "@/lib/email/config";
import {
  EMAIL_SEND_FAILED,
  EMAIL_SENDER_NOT_AUTHORISED,
  MICROSOFT_EMAIL_NOT_CONFIGURED,
  EmailProviderError,
} from "@/lib/email/errors";
import { createMsalTokenProvider, type GraphTokenProvider } from "@/lib/email/graph-auth";
import type { EmailAttachment, EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/types";
import { logServerError } from "@/lib/server-log";

const GRAPH_SEND_MAIL = "https://graph.microsoft.com/v1.0/users";

export type GraphFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export class MicrosoftGraphEmailProvider implements EmailProvider {
  readonly name = "microsoft_graph";

  constructor(
    private readonly sender: string,
    private readonly tokens: GraphTokenProvider,
    private readonly fetchImpl: GraphFetch,
  ) {}

  static fromEnv(deps?: { tokens?: GraphTokenProvider; fetch?: GraphFetch }) {
    const tenantId = getMicrosoftTenantId();
    const clientId = getMicrosoftClientId();
    const clientSecret = getMicrosoftClientSecret();
    const sender = getMicrosoftGraphSender();
    if (!tenantId || !clientId || !clientSecret || !sender) {
      throw new EmailProviderError(MICROSOFT_EMAIL_NOT_CONFIGURED);
    }
    return new MicrosoftGraphEmailProvider(
      sender,
      deps?.tokens ??
        createMsalTokenProvider({
          tenantId,
          clientId,
          clientSecret,
        }),
      deps?.fetch ?? (globalThis.fetch as GraphFetch),
    );
  }

  sendMailUrl() {
    return `${GRAPH_SEND_MAIL}/${encodeURIComponent(this.sender)}/sendMail`;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (message.from && !emailsMatch(message.from, this.sender)) {
      throw new EmailProviderError(EMAIL_SENDER_NOT_AUTHORISED);
    }
    const token = await this.tokens.getAccessToken();
    const replyTo = message.replyTo?.trim() || this.sender;
    const url = this.sendMailUrl();
    if (/\/me\/sendMail(?:\?|$)/i.test(url)) {
      throw new EmailProviderError(EMAIL_SEND_FAILED);
    }

    let response: Awaited<ReturnType<GraphFetch>>;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: {
              contentType: "Text",
              content: message.text,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: message.to,
                },
              },
            ],
            replyTo: [
              {
                emailAddress: {
                  address: replyTo,
                },
              },
            ],
            ...(graphFileAttachments(message.attachments)
              ? { attachments: graphFileAttachments(message.attachments) }
              : {}),
          },
          saveToSentItems: true,
        }),
      });
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      logServerError("email_send_failed", {
        provider: this.name,
        message: error instanceof Error ? error.name : "unknown",
      });
      throw new EmailProviderError(EMAIL_SEND_FAILED);
    }

    if (response.status === 202 || response.ok) {
      return { provider: this.name, messageId: null };
    }

    const details = await readGraphError(response);
    logServerError("email_send_failed", {
      provider: this.name,
      status: response.status,
      code: details.code,
      requestId: details.requestId,
    });
    throw new EmailProviderError(EMAIL_SEND_FAILED);
  }
}

function graphFileAttachments(attachments: EmailAttachment[] | undefined) {
  if (!attachments?.length) {
    return null;
  }
  return attachments.map((item) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: item.filename,
    contentType: item.contentType,
    contentBytes: Buffer.from(item.bytes).toString("base64"),
  }));
}

async function readGraphError(response: Awaited<ReturnType<GraphFetch>>) {
  const requestId =
    response.headers.get("request-id") ||
    response.headers.get("client-request-id") ||
    "";
  let code = statusCodeLabel(response.status);
  try {
    const text = await response.text();
    const parsed = JSON.parse(text) as { error?: { code?: string } };
    if (parsed.error?.code?.trim()) {
      code = parsed.error.code.trim();
    }
  } catch {
    // Body may be empty; the HTTP status is enough for a safe diagnostic.
  }
  return { code, requestId };
}

function statusCodeLabel(status: number) {
  if (status === 401) {
    return "unauthorized";
  }
  if (status === 403) {
    return "forbidden";
  }
  if (status === 404) {
    return "mailbox_not_found";
  }
  if (status === 429) {
    return "throttled";
  }
  if (status >= 500) {
    return "graph_unavailable";
  }
  return `http_${status}`;
}
