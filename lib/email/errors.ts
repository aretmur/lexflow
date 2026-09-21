export class EmailProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailProviderError";
  }
}

export const EMAIL_NOT_CONFIGURED = "Email delivery is not configured.";
export const EMAIL_SEND_FAILED =
  "Unable to send the signing email. Check the email address or try again.";
