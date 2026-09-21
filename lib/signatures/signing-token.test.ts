import { describe, expect, it } from "vitest";
import {
  createSigningToken,
  hashSigningToken,
  isSigningTokenExpired,
  publicSigningPath,
  signingTokenExpiresAt,
} from "@/lib/signatures/signing-token";

describe("signing session tokens", () => {
  it("creates a random token and stores only its hash", () => {
    const first = createSigningToken();
    const second = createSigningToken();
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toBe(hashSigningToken(first.token));
    expect(first.hash).not.toBe(first.token);
    expect(publicSigningPath(first.token)).toBe(`/sign/${first.token}`);
  });

  it("expires after the configured lifetime", () => {
    const now = new Date("2026-09-21T00:00:00.000Z");
    const expiresAt = signingTokenExpiresAt(now);
    expect(isSigningTokenExpired(expiresAt, now)).toBe(false);
    expect(
      isSigningTokenExpired(expiresAt, new Date("2026-09-21T01:59:00.000Z")),
    ).toBe(false);
    expect(
      isSigningTokenExpired(expiresAt, new Date("2026-09-21T02:00:00.000Z")),
    ).toBe(true);
    expect(isSigningTokenExpired(null, now)).toBe(true);
  });
});
