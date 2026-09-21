export const CONSENT_TEXT_VERSION = "2026-09-v1";

export function consentText(signerName: string) {
  return `I confirm that I am ${signerName}, that I have reviewed this costs agreement, and that I intend my electronic signature to be my signature on this document.`;
}
