import { getSignatureProvider } from "@/lib/signatures/provider";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import { handleProviderEvent } from "@/lib/signatures/workflow";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/server-log";

const HELLO_API_EVENT_RECEIVED = "Hello API Event Received";

export async function POST(request: Request) {
  try {
    const raw = await readWebhookPayload(request);
    if (!raw) {
      return new Response("Missing webhook payload", { status: 400 });
    }

    const payload = JSON.parse(raw) as {
      event?: { event_time?: string | number; event_type?: string; event_hash?: string };
    };
    const provider = getSignatureProvider();
    const eventTime = String(payload.event?.event_time ?? "");
    const eventType = String(payload.event?.event_type ?? "");
    const eventHash = String(payload.event?.event_hash ?? "");

    if (!provider.verifyWebhook({ eventTime, eventType, eventHash })) {
      return new Response("Invalid webhook signature", { status: 401 });
    }

    const event = provider.parseWebhook(payload);
    const store = createSupabaseSignatureStore(createAdminSupabaseClient());
    await handleProviderEvent({ store, provider, event });

    return new Response(HELLO_API_EVENT_RECEIVED, { status: 200 });
  } catch (error) {
    logServerError("dropbox_sign_webhook_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Webhook processing failed", { status: 500 });
  }
}

async function readWebhookPayload(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const text = await request.text();
    return text.trim() || null;
  }

  const form = await request.formData();
  const json = form.get("json");
  if (typeof json === "string" && json.trim()) {
    return json;
  }
  return null;
}
