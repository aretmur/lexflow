import { getDropboxSignConfig } from "@/lib/signatures/config";
import { DropboxSignProvider } from "@/lib/signatures/dropbox-sign";
import type { SignatureProvider } from "@/lib/signatures/types";

export function getSignatureProvider(): SignatureProvider {
  return new DropboxSignProvider(getDropboxSignConfig());
}

export type { SignatureProvider };
