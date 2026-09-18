import { notFound } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import { GENERATED_AGREEMENTS_BUCKET } from "@/lib/documents/pdf/storage-path";
import {
  downloadPrivateFile,
  loadLatestGeneratedPack,
} from "@/lib/agreements/packs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    notFound();
  }

  const { firm } = await requireFirm();
  const pack = await loadLatestGeneratedPack(firm.id, id);
  if (!pack) {
    notFound();
  }

  const bytes = await downloadPrivateFile(GENERATED_AGREEMENTS_BUCKET, pack.storage_path);
  if (!bytes) {
    notFound();
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `agreement-pack-v${pack.version_number}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
