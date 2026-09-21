import { getDropboxSignConfig, getConfiguredSigningProviderName } from "@/lib/signatures/config";
import { DropboxSignProvider } from "@/lib/signatures/dropbox-sign";
import { NativeLexflowProvider } from "@/lib/signatures/native";
import type { SignatureProvider, SignatureProviderName } from "@/lib/signatures/types";

export function getSignatureProvider(
  name: SignatureProviderName = getConfiguredSigningProviderName(),
): SignatureProvider {
  if (name === "dropbox_sign") {
    return new DropboxSignProvider(getDropboxSignConfig());
  }
  return new NativeLexflowProvider();
}

export type { SignatureProvider };
