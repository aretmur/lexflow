import { randomInt } from "node:crypto";
import { hashSigningToken, signingTokensEqual } from "@/lib/signatures/signing-token";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

export function createOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(requestId: string, code: string) {
  return hashSigningToken(`${requestId}:${code.trim()}`);
}

export function otpCodesEqual(left: string, right: string) {
  return signingTokensEqual(left, right);
}

export function otpExpiresAt(now = new Date()) {
  return new Date(now.getTime() + OTP_TTL_MS).toISOString();
}

export function isOtpExpired(expiresAt: string | null, now = new Date()) {
  if (!expiresAt) {
    return true;
  }
  const expiry = new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

export function otpResendAllowed(lastSentAt: string | null, now = new Date()) {
  if (!lastSentAt) {
    return true;
  }
  const sent = new Date(lastSentAt);
  if (Number.isNaN(sent.getTime())) {
    return true;
  }
  return now.getTime() - sent.getTime() >= OTP_RESEND_COOLDOWN_MS;
}
