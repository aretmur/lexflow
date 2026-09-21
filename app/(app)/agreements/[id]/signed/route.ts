import { notFound } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import { SIGNED_AGREEMENTS_BUCKET } from "@/lib/documents/pdf/storage-path";
import { downloadPrivateFile } from "@/lib/agreements/packs";
import { loadSignedAgreementDocument } from "@/lib/signatures/load";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    notFound();
  }

  const { firm } = await requireFirm();
  const signed = await loadSignedAgreementDocument(firm.id, id);
  if (!signed || signed.firmId !== firm.id) {
    notFound();
  }

  const bytes = await downloadPrivateFile(SIGNED_AGREEMENTS_BUCKET, signed.storagePath);
  if (!bytes) {
    notFound();
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = "signed-agreement.pdf";

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
