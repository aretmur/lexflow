export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage) {
    this.sent.push(message);
    console.info("[lexflow:email]", {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

let override: EmailProvider | null = null;

export function setEmailProviderForTests(provider: EmailProvider | null) {
  override = provider;
}

export function getEmailProvider(): EmailProvider {
  return override ?? new ConsoleEmailProvider();
}
