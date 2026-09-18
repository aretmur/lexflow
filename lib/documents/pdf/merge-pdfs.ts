import { PDFDocument } from "pdf-lib";
import { DocumentGenerationError } from "@/lib/documents/errors";

export type MergedPdf = {
  bytes: Uint8Array;
  pageCount: number;
  agreementPageCount: number;
  attachmentPageCount: number;
};

export async function mergeAgreementAndAttachment(
  agreementPdf: Uint8Array,
  attachmentPdf: Uint8Array,
): Promise<MergedPdf> {
  let agreementDoc: PDFDocument;
  let attachmentDoc: PDFDocument;
  try {
    agreementDoc = await PDFDocument.load(agreementPdf, { ignoreEncryption: false });
  } catch {
    throw new DocumentGenerationError("The generated agreement PDF could not be read.");
  }
  try {
    attachmentDoc = await PDFDocument.load(attachmentPdf, { ignoreEncryption: false });
  } catch {
    throw new DocumentGenerationError("The required attachment PDF could not be read.");
  }

  const agreementPageCount = agreementDoc.getPageCount();
  const attachmentPageCount = attachmentDoc.getPageCount();
  if (agreementPageCount < 1) {
    throw new DocumentGenerationError("The generated agreement PDF has no pages.");
  }
  if (attachmentPageCount < 1) {
    throw new DocumentGenerationError("The required attachment PDF has no pages.");
  }

  const merged = await PDFDocument.create();
  const agreementPages = await merged.copyPages(
    agreementDoc,
    agreementDoc.getPageIndices(),
  );
  agreementPages.forEach((page) => merged.addPage(page));
  const attachmentPages = await merged.copyPages(
    attachmentDoc,
    attachmentDoc.getPageIndices(),
  );
  attachmentPages.forEach((page) => merged.addPage(page));

  const bytes = await merged.save({ useObjectStreams: false });
  return {
    bytes,
    pageCount: merged.getPageCount(),
    agreementPageCount,
    attachmentPageCount,
  };
}
