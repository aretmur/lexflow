import { loadNativeSigningPack } from "@/lib/signatures/native-workflow";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import { SignatureWorkflowError } from "@/lib/signatures/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  try {
    const pack = await loadNativeSigningPack({
      store: createSupabaseSignatureStore(createAdminSupabaseClient()),
      token,
    });
    return new Response(Buffer.from(pack.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pack.bytes.byteLength),
        "Content-Disposition": `inline; filename="${pack.fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof SignatureWorkflowError
        ? error.message
        : "The agreement pack could not be retrieved.";
    const status = /expired|verify your email/i.test(message) ? 401 : 404;
    return new Response(message, { status });
  }
}
