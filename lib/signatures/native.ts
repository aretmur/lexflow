import { randomUUID } from "node:crypto";
import {
  SignatureProviderError,
  type CreateEmbeddedSignatureRequestResult,
  type CreateSignatureRequestResult,
  type EmbeddedSignUrl,
  type ProviderWebhookEvent,
  type SignatureProvider,
  type SignatureRequestDetails,
} from "@/lib/signatures/types";

export class NativeLexflowProvider implements SignatureProvider {
  readonly name = "native_lexflow" as const;

  async createSignatureRequest(): Promise<CreateSignatureRequestResult> {
    return {
      providerRequestId: `native_${randomUUID()}`,
    };
  }

  async createEmbeddedSignatureRequest(): Promise<CreateEmbeddedSignatureRequestResult> {
    const id = `native_${randomUUID()}`;
    return {
      providerRequestId: id,
      providerSignatureId: id,
    };
  }

  async getEmbeddedSignUrl(): Promise<EmbeddedSignUrl> {
    throw new SignatureProviderError(
      "Native Lexflow signing does not use a third-party embedded URL.",
    );
  }

  async getSignatureRequest(providerRequestId: string): Promise<SignatureRequestDetails> {
    return {
      providerRequestId,
      isComplete: false,
      isDeclined: false,
      isCancelled: false,
      isExpired: false,
      signerEmail: null,
    };
  }

  async cancelSignatureRequest(): Promise<void> {
    return;
  }

  async remindSignatureRequest(): Promise<void> {
    return;
  }

  async downloadSignedDocument(): Promise<Uint8Array> {
    throw new SignatureProviderError(
      "Native Lexflow signing stores the executed PDF in Lexflow, not with an external provider.",
    );
  }

  verifyWebhook(): boolean {
    return false;
  }

  parseWebhook(): ProviderWebhookEvent {
    throw new SignatureProviderError("Native Lexflow signing does not receive provider webhooks.");
  }
}
