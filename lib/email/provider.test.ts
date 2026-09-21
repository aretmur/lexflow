import { afterEach, describe, expect, it } from "vitest";
import { ConsoleEmailProvider, getEmailProvider, setEmailProviderForTests } from "@/lib/email/provider";
import { EMAIL_NOT_CONFIGURED, EmailProviderError } from "@/lib/email/errors";
import { ResendEmailProvider } from "@/lib/email/resend";

const original = {
  key: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  reply: process.env.EMAIL_REPLY_TO,
  provider: process.env.EMAIL_PROVIDER,
  vercel: process.env.VERCEL_ENV,
};

afterEach(() => {
  setEmailProviderForTests(null);
  restore("RESEND_API_KEY", original.key);
  restore("EMAIL_FROM", original.from);
  restore("EMAIL_REPLY_TO", original.reply);
  restore("EMAIL_PROVIDER", original.provider);
  restore("VERCEL_ENV", original.vercel);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("email provider selection", () => {
  it("fails clearly in production without email configuration", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_PROVIDER;
    process.env.VERCEL_ENV = "production";
    expect(() => getEmailProvider()).toThrow(EmailProviderError);
    expect(() => getEmailProvider()).toThrow(EMAIL_NOT_CONFIGURED);
  });

  it("never silently uses ConsoleEmailProvider in production", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
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
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.VERCEL_ENV;
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("uses Resend when the API key and EMAIL_FROM are configured", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Octagon Legal <intake@octagonlegal.au>";
    delete process.env.EMAIL_PROVIDER;
    delete process.env.VERCEL_ENV;
    expect(getEmailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  it("uses the console provider when EMAIL_PROVIDER=console", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Octagon Legal <intake@octagonlegal.au>";
    process.env.EMAIL_PROVIDER = "console";
    process.env.VERCEL_ENV = "production";
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });
});
