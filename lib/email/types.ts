export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  from?: string;
};

export type EmailSendResult = {
  provider: string;
  messageId: string | null;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
