import { SignatureProviderError } from "@/lib/signatures/types";

export type DropboxSignConfig = {
  apiKey: string;
  clientId?: string;
  testMode: boolean;
  apiBaseUrl: string;
};

export function isDropboxSignTestMode() {
  return process.env.DROPBOX_SIGN_TEST_MODE === "true";
}

export function getDropboxSignConfig(): DropboxSignConfig {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY?.trim();
  if (!apiKey) {
    throw new SignatureProviderError("Electronic signing is not configured.");
  }

  return {
    apiKey,
    clientId: process.env.DROPBOX_SIGN_CLIENT_ID?.trim() || undefined,
    testMode: isDropboxSignTestMode(),
    apiBaseUrl: "https://api.hellosign.com/v3",
  };
}
