import { createHmac, timingSafeEqual } from "node:crypto";
import {
  SignatureProviderError,
  type CreateSignatureRequestInput,
  type CreateSignatureRequestResult,
  type ProviderWebhookEvent,
  type SignatureProvider,
  type SignatureRequestDetails,
  type SignatureWebhookEventType,
  type VerifyWebhookInput,
} from "@/lib/signatures/types";
import type { DropboxSignConfig } from "@/lib/signatures/config";

type FetchLike = typeof fetch;

const EVENT_TYPE_MAP: Record<string, SignatureWebhookEventType> = {
  signature_request_sent: "sent",
  signature_request_viewed: "viewed",
  signature_request_signed: "signed",
  signature_request_all_signed: "completed",
  signature_request_downloadable: "downloadable",
  signature_request_declined: "declined",
  signature_request_canceled: "cancelled",
  signature_request_cancelled: "cancelled",
  signature_request_expired: "expired",
  signature_request_invalid: "failed",
  file_error: "failed",
  error: "failed",
};

type DropboxErrorBody = {
  error?: { error_msg?: string; error_name?: string };
};

type DropboxSignatureRequestBody = {
  signature_request?: {
    signature_request_id?: string;
    is_complete?: boolean;
    is_declined?: boolean;
    signatures?: Array<{
      signer_email_address?: string;
      status_code?: string;
    }>;
  };
};

type DropboxWebhookBody = {
  event?: {
    event_type?: string;
    event_time?: string | number;
    event_hash?: string;
  };
  signature_request?: {
    signature_request_id?: string;
  };
};

export class DropboxSignProvider implements SignatureProvider {
  readonly name = "dropbox_sign" as const;

  constructor(
    private readonly config: DropboxSignConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async createSignatureRequest(
    input: CreateSignatureRequestInput,
  ): Promise<CreateSignatureRequestResult> {
    const form = new FormData();
    form.set("title", input.title);
    form.set("subject", input.subject);
    if (input.message) {
      form.set("message", input.message);
    }
    form.set("signers[0][name]", input.signer.name);
    form.set("signers[0][email_address]", input.signer.email);
    form.set("signers[0][order]", "0");
    form.set("use_text_tags", "1");
    form.set("hide_text_tags", "0");
    form.set("test_mode", input.testMode ? "1" : "0");
    form.set("signing_redirect_url", input.signingRedirectUrl);
    if (input.clientId || this.config.clientId) {
      form.set("client_id", input.clientId ?? this.config.clientId ?? "");
    }
    for (const [key, value] of Object.entries(input.metadata)) {
      form.set(`metadata[${key}]`, value);
    }
    form.set(
      "file[0]",
      new Blob([Uint8Array.from(input.fileBytes)], { type: "application/pdf" }),
      input.fileName,
    );

    const body = await this.requestJson<DropboxSignatureRequestBody>(
      "/signature_request/send",
      { method: "POST", body: form },
    );
    const providerRequestId = body.signature_request?.signature_request_id;
    if (!providerRequestId) {
      throw new SignatureProviderError(
        "Dropbox Sign did not return a signature request id.",
      );
    }
    return { providerRequestId };
  }

  async getSignatureRequest(
    providerRequestId: string,
  ): Promise<SignatureRequestDetails> {
    const body = await this.requestJson<DropboxSignatureRequestBody>(
      `/signature_request/${encodeURIComponent(providerRequestId)}`,
    );
    const request = body.signature_request;
    if (!request?.signature_request_id) {
      throw new SignatureProviderError("Signature request was not found.");
    }
    const statuses = (request.signatures ?? []).map((signature) => signature.status_code);
    return {
      providerRequestId: request.signature_request_id,
      isComplete: Boolean(request.is_complete),
      isDeclined: Boolean(request.is_declined) || statuses.includes("declined"),
      isCancelled: statuses.includes("canceled") || statuses.includes("cancelled"),
      isExpired: statuses.includes("expired"),
      signerEmail: request.signatures?.[0]?.signer_email_address ?? null,
    };
  }

  async cancelSignatureRequest(providerRequestId: string): Promise<void> {
    await this.requestJson(
      `/signature_request/cancel/${encodeURIComponent(providerRequestId)}`,
      { method: "POST" },
    );
  }

  async remindSignatureRequest(providerRequestId: string, email: string): Promise<void> {
    const form = new FormData();
    form.set("email_address", email);
    await this.requestJson(
      `/signature_request/remind/${encodeURIComponent(providerRequestId)}`,
      { method: "POST", body: form },
    );
  }

  async downloadSignedDocument(providerRequestId: string): Promise<Uint8Array> {
    const response = await this.request(
      `/signature_request/files/${encodeURIComponent(providerRequestId)}`,
      { headers: { Accept: "application/pdf" } },
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 5 || Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") {
      throw new SignatureProviderError("Dropbox Sign did not return a signed PDF.");
    }
    return bytes;
  }

  verifyWebhook(input: VerifyWebhookInput): boolean {
    const expected = createHmac("sha256", this.config.apiKey)
      .update(`${input.eventTime}${input.eventType}`)
      .digest("hex");
    const received = input.eventHash.trim().toLowerCase();
    if (expected.length !== received.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  }

  parseWebhook(payload: unknown): ProviderWebhookEvent {
    const body = payload as DropboxWebhookBody;
    const eventType = String(body.event?.event_type ?? "");
    const eventTime = String(body.event?.event_time ?? "");
    const eventHash = String(body.event?.event_hash ?? "");
    const providerRequestId = body.signature_request?.signature_request_id ?? null;
    if (!eventType || !eventTime) {
      throw new SignatureProviderError("Dropbox Sign webhook payload is missing event fields.");
    }
    return {
      eventId:
        eventHash ||
        [eventTime, eventType, providerRequestId ?? "unknown"].join(":"),
      eventType: EVENT_TYPE_MAP[eventType] ?? "ignored",
      providerEventType: eventType,
      providerRequestId,
      occurredAt: toIso(eventTime),
      eventHash,
    };
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await this.request(path, init);
    const body = (await response.json()) as T & DropboxErrorBody;
    if (!response.ok || body.error) {
      throw new SignatureProviderError(
        body.error?.error_msg || `Dropbox Sign request failed (${response.status}).`,
      );
    }
    return body;
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set(
      "Authorization",
      `Basic ${Buffer.from(`${this.config.apiKey}:`).toString("base64")}`,
    );
    const response = await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok && !isJsonResponse(response)) {
      throw new SignatureProviderError(
        `Dropbox Sign request failed (${response.status}).`,
      );
    }
    return response;
  }
}

function isJsonResponse(response: Response) {
  return (response.headers.get("content-type") ?? "").includes("application/json");
}

function toIso(eventTime: string) {
  const seconds = Number(eventTime);
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}
