import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SIGNING_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export function createSigningToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSigningToken(token) };
}

export function hashSigningToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function signingTokensEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function signingTokenExpiresAt(now = new Date()) {
  return new Date(now.getTime() + SIGNING_TOKEN_TTL_MS).toISOString();
}

export function isSigningTokenExpired(expiresAt: string | null, now = new Date()) {
  if (!expiresAt) {
    return true;
  }
  const expiry = new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

export function publicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function publicSigningPath(token: string) {
  return `/sign/${token}`;
}

export function publicSigningUrl(token: string) {
  return `${publicSiteUrl()}${publicSigningPath(token)}`;
}
