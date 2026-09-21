import { afterEach, describe, expect, it } from "vitest";
import { ConsoleEmailProvider, getEmailProvider, setEmailProviderForTests } from "@/lib/email/provider";
import {
  EMAIL_NOT_CONFIGURED,
  MICROSOFT_EMAIL_NOT_CONFIGURED,
  EmailProviderError,
} from "@/lib/email/errors";
import { MicrosoftGraphEmailProvider } from "@/lib/email/graph";
import { ResendEmailProvider } from "@/lib/email/resend";

const original = {
  key: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  reply: process.env.EMAIL_REPLY_TO,
  provider: process.env.EMAIL_PROVIDER,
  vercel: process.env.VERCEL_ENV,
  tenant: process.env.MICROSOFT_TENANT_ID,
  client: process.env.MICROSOFT_CLIENT_ID,
  secret: process.env.MICROSOFT_CLIENT_SECRET,
  sender: process.env.MICROSOFT_GRAPH_SENDER,
};

afterEach(() => {
  setEmailProviderForTests(null);
  restore("RESEND_API_KEY", original.key);
  restore("EMAIL_FROM", original.from);
  restore("EMAIL_REPLY_TO", original.reply);
  restore("EMAIL_PROVIDER", original.provider);
  restore("VERCEL_ENV", original.vercel);
  restore("MICROSOFT_TENANT_ID", original.tenant);
  restore("MICROSOFT_CLIENT_ID", original.client);
  restore("MICROSOFT_CLIENT_SECRET", original.secret);
  restore("MICROSOFT_GRAPH_SENDER", original.sender);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function clearEmailConfig() {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_REPLY_TO;
  delete process.env.EMAIL_PROVIDER;
  delete process.env.MICROSOFT_TENANT_ID;
  delete process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_SECRET;
  delete process.env.MICROSOFT_GRAPH_SENDER;
}

describe("email provider selection", () => {
  it("fails clearly in production without email configuration", () => {
    clearEmailConfig();
    process.env.VERCEL_ENV = "production";
    expect(() => getEmailProvider()).toThrow(EmailProviderError);
    expect(() => getEmailProvider()).toThrow(EMAIL_NOT_CONFIGURED);
  });

  it("never silently uses ConsoleEmailProvider in production", () => {
    clearEmailConfig();
    process.env.VERCEL_ENV = "production";
    try {
      getEmailProvider();
      throw new Error("expected configuration error");
    } catch (error) {
      expect(error).toBeInstanceOf(EmailProviderError);
      expect(String(error)).not.toMatch(/console/i);
    }
  });

  it("uses the console provider in development and tests", () => {
    clearEmailConfig();
    delete process.env.VERCEL_ENV;
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("selects Microsoft Graph when EMAIL_PROVIDER=microsoft_graph", () => {
    clearEmailConfig();
    process.env.EMAIL_PROVIDER = "microsoft_graph";
    process.env.MICROSOFT_TENANT_ID = "tenant-id";
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_GRAPH_SENDER = "intake@octagonlegal.au";
    expect(getEmailProvider()).toBeInstanceOf(MicrosoftGraphEmailProvider);
  });

  it("fails when Microsoft Graph is selected but configuration is missing", () => {
    clearEmailConfig();
    process.env.EMAIL_PROVIDER = "microsoft_graph";
    process.env.VERCEL_ENV = "production";
    expect(() => getEmailProvider()).toThrow(MICROSOFT_EMAIL_NOT_CONFIGURED);
  });

  it("does not require Resend when Microsoft Graph is selected", () => {
    clearEmailConfig();
    process.env.EMAIL_PROVIDER = "microsoft_graph";
    process.env.MICROSOFT_TENANT_ID = "tenant-id";
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_GRAPH_SENDER = "intake@octagonlegal.au";
    const provider = getEmailProvider();
    expect(provider).toBeInstanceOf(MicrosoftGraphEmailProvider);
    expect(provider).not.toBeInstanceOf(ResendEmailProvider);
  });

  it("uses Resend when EMAIL_PROVIDER=resend and credentials are set", () => {
    clearEmailConfig();
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Octagon Legal <intake@octagonlegal.au>";
    expect(getEmailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  it("uses Microsoft Graph in production when Microsoft configuration is present", () => {
    clearEmailConfig();
    process.env.VERCEL_ENV = "production";
    process.env.MICROSOFT_TENANT_ID = "tenant-id";
    process.env.MICROSOFT_CLIENT_ID = "client-id";
    process.env.MICROSOFT_CLIENT_SECRET = "client-secret";
    process.env.MICROSOFT_GRAPH_SENDER = "intake@octagonlegal.au";
    expect(getEmailProvider()).toBeInstanceOf(MicrosoftGraphEmailProvider);
  });

  it("fails with the Microsoft configuration error when production has incomplete Microsoft env", () => {
    clearEmailConfig();
    process.env.VERCEL_ENV = "production";
    process.env.MICROSOFT_GRAPH_SENDER = "intake@octagonlegal.au";
    expect(() => getEmailProvider()).toThrow(MICROSOFT_EMAIL_NOT_CONFIGURED);
  });

  it("uses the console provider when EMAIL_PROVIDER=console", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Octagon Legal <intake@octagonlegal.au>";
    process.env.EMAIL_PROVIDER = "console";
    process.env.VERCEL_ENV = "production";
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });
});
