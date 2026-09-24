import {
  getConfiguredEmailProviderName,
  hasAnyMicrosoftGraphEnv,
  hasMicrosoftGraphConfig,
  hasResendConfig,
  isProductionEmailRequired,
} from "@/lib/email/config";
import {
  EMAIL_NOT_CONFIGURED,
  MICROSOFT_EMAIL_NOT_CONFIGURED,
  EmailProviderError,
} from "@/lib/email/errors";
import { MicrosoftGraphEmailProvider } from "@/lib/email/graph";
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

  const selected = getConfiguredEmailProviderName();
  if (selected === "console") {
    return new ConsoleEmailProvider();
  }
  if (selected === "microsoft_graph") {
    return MicrosoftGraphEmailProvider.fromEnv();
  }
  if (selected === "resend") {
    return ResendEmailProvider.fromEnv();
  }

  if (hasMicrosoftGraphConfig()) {
    return MicrosoftGraphEmailProvider.fromEnv();
  }
  if (hasResendConfig()) {
    return ResendEmailProvider.fromEnv();
  }
  if (isProductionEmailRequired()) {
    if (hasAnyMicrosoftGraphEnv()) {
      throw new EmailProviderError(MICROSOFT_EMAIL_NOT_CONFIGURED);
    }
    throw new EmailProviderError(EMAIL_NOT_CONFIGURED);
  }
  return new ConsoleEmailProvider();
}

export {
  EMAIL_NOT_CONFIGURED,
  EMAIL_SEND_FAILED,
  EMAIL_SENDER_NOT_AUTHORISED,
  MICROSOFT_EMAIL_NOT_CONFIGURED,
  SIGNED_PDF_TOO_LARGE,
  FIRM_SIGNED_COPY_EMAIL_MISSING,
  EmailProviderError,
} from "@/lib/email/errors";
