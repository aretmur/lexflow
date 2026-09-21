export const DROPBOX_SIGN_SIGNER_ROLE = "signer1";

export const DROPBOX_SIGN_TEXT_TAGS = {
  signature: "[sig|req|signer1|180|36]",
  name: "[text|req|signer1|180|16]",
  date: "[date|req|signer1|120|16]",
} as const;

export const SIGNING_EMAIL_SUBJECT = "Please review and sign your costs agreement";

export const DEFAULT_SIGNING_REDIRECT_URL =
  "https://www.lexflow.com.au/signing-complete";

export function signingRedirectUrl() {
  return process.env.SIGNING_REDIRECT_URL?.trim() || DEFAULT_SIGNING_REDIRECT_URL;
}
