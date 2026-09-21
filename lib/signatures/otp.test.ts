import { describe, expect, it } from "vitest";
import {
  createOtpCode,
  hashOtpCode,
  isOtpExpired,
  otpCodesEqual,
  otpExpiresAt,
  otpResendAllowed,
} from "@/lib/signatures/otp";

describe("signing OTP", () => {
  it("creates a 6-digit code and stores only a hash", () => {
    const code = createOtpCode();
    expect(code).toMatch(/^\d{6}$/);
    const hash = hashOtpCode("req-1", code);
    expect(hash).not.toBe(code);
    expect(hash).toBe(hashOtpCode("req-1", code));
    expect(hash).not.toBe(hashOtpCode("req-2", code));
    expect(otpCodesEqual(hash, hashOtpCode("req-1", ` ${code} `))).toBe(true);
  });

  it("expires after 10 minutes and enforces resend cooldown", () => {
    const now = new Date("2026-09-21T00:00:00.000Z");
    expect(isOtpExpired(otpExpiresAt(now), now)).toBe(false);
    expect(isOtpExpired(otpExpiresAt(now), new Date("2026-09-21T00:10:00.000Z"))).toBe(true);
    expect(otpResendAllowed(null, now)).toBe(true);
    expect(otpResendAllowed(now.toISOString(), new Date("2026-09-21T00:00:29.000Z"))).toBe(false);
    expect(otpResendAllowed(now.toISOString(), new Date("2026-09-21T00:00:30.000Z"))).toBe(true);
  });
});
