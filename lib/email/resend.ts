import { Resend } from "resend";
import { getEmailFrom, getEmailReplyTo, getResendApiKey } from "@/lib/email/config";
import {
  EMAIL_NOT_CONFIGURED,
  EMAIL_SEND_FAILED,
  EmailProviderError,
} from "@/lib/email/errors";
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/types";
import { logServerError } from "@/lib/server-log";

export type ResendClient = {
  emails: {
    send: (payload: {
      from: string;
      to: string | string[];
      subject: string;
      text: string;
      replyTo?: string;
    }) => Promise<{ data?: { id?: string | null } | null; error?: { message?: string } | null }>;
  };
};

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly from: string,
    private readonly replyTo: string | undefined,
    private readonly client: ResendClient,
  ) {}

  static fromEnv(client?: ResendClient) {
    const apiKey = getResendApiKey();
    const from = getEmailFrom();
    if (!apiKey || !from) {
      throw new EmailProviderError(EMAIL_NOT_CONFIGURED);
    }
    return new ResendEmailProvider(
      from,
      getEmailReplyTo() || undefined,
      client ?? new Resend(apiKey),
    );
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const replyTo = message.replyTo?.trim() || this.replyTo;
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(replyTo ? { replyTo } : {}),
      });
      if (error || !data?.id) {
        logServerError("email_send_failed", {
          provider: "resend",
          message: safeDiagnostic(error?.message ?? "missing_id"),
        });
        throw new EmailProviderError(EMAIL_SEND_FAILED);
      }
      return { provider: this.name, messageId: data.id };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      logServerError("email_send_failed", {
        provider: "resend",
        message: safeDiagnostic(error instanceof Error ? error.message : "unknown"),
      });
      throw new EmailProviderError(EMAIL_SEND_FAILED);
    }
  }
}

function safeDiagnostic(message: string) {
  return message.replace(/re_[A-Za-z0-9_]+/g, "[redacted]");
}
