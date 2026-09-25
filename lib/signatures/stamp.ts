import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { pageGeometriesFromPdf } from "@/lib/signatures/form-fields";
import {
  EXECUTION_LAYOUT,
  executionPageNumber,
  initialsPlacement,
} from "@/lib/signatures/execution-layout";
import {
  fallbackExecutionSlots,
  findExecutionSlots,
} from "@/lib/signatures/execution-slots";
import { SignatureWorkflowError } from "@/lib/signatures/types";

export type DrawnMark = {
  kind: "draw";
  pngBase64: string;
};

export type TypedMark = {
  kind: "type";
  text: string;
};

export type SignatureMark = DrawnMark | TypedMark;

export type StampExecutionInput = {
  packBytes: Uint8Array;
  expectedSha256: string;
  requirePageInitials: boolean;
  agreementPageCount: number;
  initials: SignatureMark;
  initialledPages: number[];
  signature: SignatureMark;
  signerName: string;
  signerCapacity: string;
  signedDate: string;
};

function decodePng(pngBase64: string) {
  const cleaned = pngBase64.replace(/^data:image\/png;base64,/, "");
  const bytes = Buffer.from(cleaned, "base64");
  if (bytes.byteLength < 24 || bytes.subarray(0, 8).toString("binary") !== "\x89PNG\r\n\x1a\n") {
    throw new SignatureWorkflowError("The captured mark could not be read.");
  }
  return bytes;
}

export async function stampExecutedPdf(input: StampExecutionInput) {
  if (sha256Hex(input.packBytes) !== input.expectedSha256) {
    throw new SignatureWorkflowError("The generated agreement pack has changed and cannot be signed.");
  }

  const document = await PDFDocument.load(input.packBytes);
  const pages = document.getPages();
  if (pages.length < 1) {
    throw new SignatureWorkflowError("The generated agreement pack has no pages.");
  }

  const geometries = await pageGeometriesFromPdf(input.packBytes);
  const font = await document.embedFont(StandardFonts.TimesRomanItalic);
  const labelFont = await document.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.05, 0.07, 0.1);

  if (input.requirePageInitials) {
    const required = new Set(geometries.map((page) => page.page));
    if (input.initialledPages.length !== required.size) {
      throw new SignatureWorkflowError("Every page must be initialled before signing.");
    }
    for (const pageNumber of input.initialledPages) {
      if (!required.has(pageNumber)) {
        throw new SignatureWorkflowError("Initials were submitted for an unknown page.");
      }
    }
    for (const geometry of geometries) {
      const page = pages[geometry.page - 1];
      const box = initialsPlacement(geometry);
      await drawMark(document, page, input.initials, box, font, ink);
    }
  }

  const execPage = executionPageNumber(input.agreementPageCount, pages.length);
  const located = findExecutionSlots(pages);
  const slots =
    located && Number.isFinite(located.signature.y) && Number.isFinite(located.name.y)
      ? located
      : fallbackExecutionSlots(execPage - 1);
  const page = pages[slots.pageIndex] ?? pages[execPage - 1];
  const capacity = input.signerCapacity.trim();
  if (!capacity) {
    throw new SignatureWorkflowError("Enter the capacity in which you are signing.");
  }
  await drawMark(
    document,
    page,
    input.signature,
    {
      x: slots.signature.x,
      y: slots.signature.y,
      width: EXECUTION_LAYOUT.signature.width,
      height: EXECUTION_LAYOUT.signature.height,
    },
    font,
    ink,
  );
  page.drawText(input.signerName.slice(0, 80), {
    x: slots.name.x,
    y: slots.name.y,
    size: 11,
    font,
    color: ink,
  });
  page.drawText(capacity.slice(0, 80), {
    x: slots.capacity.x,
    y: slots.capacity.y,
    size: 10,
    font: labelFont,
    color: ink,
  });
  page.drawText(input.signedDate, {
    x: slots.date.x,
    y: slots.date.y,
    size: 10,
    font: labelFont,
    color: ink,
  });

  const bytes = await document.save({ useObjectStreams: false });
  return {
    bytes,
    sha256: sha256Hex(bytes),
    pageCount: pages.length,
  };
}

async function drawMark(
  document: PDFDocument,
  page: ReturnType<PDFDocument["getPages"]>[number],
  mark: SignatureMark,
  box: { x: number; y: number; width: number; height: number },
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>,
) {
  if (mark.kind === "draw") {
    const image = await document.embedPng(decodePng(mark.pngBase64));
    page.drawImage(image, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    return;
  }
  const text = mark.text.trim();
  if (!text) {
    throw new SignatureWorkflowError("A typed signature or initials value is required.");
  }
  page.drawText(text.slice(0, 40), {
    x: box.x,
    y: box.y + 1,
    size: Math.min(13, Math.max(11, box.height - 8)),
    font,
    color,
  });
}
