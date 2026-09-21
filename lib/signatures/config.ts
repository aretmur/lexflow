import { SignatureProviderError, type SignatureProviderName } from "@/lib/signatures/types";

export type DropboxSignConfig = {
  apiKey: string;
  clientId?: string;
  testMode: boolean;
  apiBaseUrl: string;
};

export function isDropboxSignTestMode() {
  return process.env.DROPBOX_SIGN_TEST_MODE === "true";
}

export function isSigningTestMode() {
  return process.env.SIGNING_TEST_MODE === "true";
}

export function getConfiguredSigningProviderName(): SignatureProviderName {
  const value = process.env.SIGNING_PROVIDER?.trim();
  if (value === "dropbox_sign") {
    return "dropbox_sign";
  }
  return "native_lexflow";
}

export function firmSigningProvider(
  firmProvider?: string | null,
): SignatureProviderName {
  if (firmProvider === "dropbox_sign" || firmProvider === "native_lexflow") {
    return firmProvider;
  }
  return getConfiguredSigningProviderName();
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
