import { DocumentGenerationError } from "@/lib/documents/errors";
import { buildDocumentModel } from "@/lib/documents/from-snapshot";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { mergeAgreementAndAttachment } from "@/lib/documents/pdf/merge-pdfs";
import { renderAgreementPdf } from "@/lib/documents/renderers/render-pdf";
import { overlayExecutionFrame } from "@/lib/signatures/execution-layout";
import { executionWordingForTemplate } from "@/lib/documents/templates/vic/wording";

export type GeneratedPackBytes = {
  bytes: Uint8Array;
  sha256: string;
  pageCount: number;
  agreementPageCount: number;
  attachmentPageCount: number;
  templateKey: string;
  templateVersion: string;
  requiredAttachmentId: string;
  requiredAttachmentVersion: number;
};

export async function generateAgreementPackBytes(input: {
  snapshot: unknown;
  attachmentBytes: Uint8Array;
  logoBytes?: Uint8Array | null;
}): Promise<GeneratedPackBytes> {
  if (!input.attachmentBytes.byteLength) {
    throw new DocumentGenerationError("The required attachment could not be retrieved.");
  }

  const model = buildDocumentModel(input.snapshot, input.logoBytes ?? null);
  const agreementPdf = await overlayExecutionFrame(
    await renderAgreementPdf(model),
    executionWordingForTemplate(model.metadata.templateKey),
  );
  const merged = await mergeAgreementAndAttachment(agreementPdf, input.attachmentBytes);

  return {
    bytes: merged.bytes,
    sha256: sha256Hex(merged.bytes),
    pageCount: merged.pageCount,
    agreementPageCount: merged.agreementPageCount,
    attachmentPageCount: merged.attachmentPageCount,
    templateKey: model.metadata.templateKey,
    templateVersion: model.metadata.templateVersion,
    requiredAttachmentId: model.snapshot.attachment!.id,
    requiredAttachmentVersion: model.snapshot.attachment!.version,
  };
}
