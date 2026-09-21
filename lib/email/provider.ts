import { hasResendConfig, isExplicitConsoleEmail, isProductionEmailRequired } from "@/lib/email/config";
import { EMAIL_NOT_CONFIGURED, EmailProviderError } from "@/lib/email/errors";
import { ResendEmailProvider } from "@/lib/email/resend";
import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/types";

export type { EmailMessage, EmailProvider, EmailSendResult };

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    console.info("[lexflow:email]", {
      to: message.to,
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo,
    });
    return { provider: this.name, messageId: null };
  }
}

let override: EmailProvider | null = null;

export function setEmailProviderForTests(provider: EmailProvider | null) {
  override = provider;
}

export function getEmailProvider(): EmailProvider {
  if (override) {
    return override;
  }
  if (hasResendConfig() && !isExplicitConsoleEmail()) {
    return ResendEmailProvider.fromEnv();
  }
  if (isProductionEmailRequired()) {
    throw new EmailProviderError(EMAIL_NOT_CONFIGURED);
  }
  return new ConsoleEmailProvider();
}

export { EMAIL_NOT_CONFIGURED, EMAIL_SEND_FAILED, EmailProviderError } from "@/lib/email/errors";
