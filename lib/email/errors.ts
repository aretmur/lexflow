export class EmailProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailProviderError";
  }
}

export const EMAIL_NOT_CONFIGURED = "Email delivery is not configured.";
export const MICROSOFT_EMAIL_NOT_CONFIGURED =
  "Microsoft 365 email delivery is not configured.";
export const EMAIL_SENDER_NOT_AUTHORISED =
  "This firm is not authorised to send from the configured Microsoft 365 mailbox.";
export const EMAIL_SEND_FAILED =
  "Unable to send the signing email. Check the email address or try again.";
