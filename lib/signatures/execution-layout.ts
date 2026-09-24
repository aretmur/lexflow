import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { clamp, INITIALS_FIELD_LAYOUT, type PageGeometry } from "@/lib/signatures/form-fields";
import { DROPBOX_SIGN_TEXT_TAGS } from "@/lib/signatures/text-tags";

/**
 * pdf-lib origin is bottom-left. Execution is drawn in this same band at
 * generate time and again when stamping values, so the blanks and the
 * signatory details share coordinates.
 */
export const EXECUTION_LAYOUT = {
  insetX: 54,
  labelWidth: 72,
  pagePaddingBottom: 210,
  heading: { y: 196, size: 13 },
  wording: { y: 178, size: 9, lineHeight: 12 },
  signature: { x: 126, y: 118, width: 280, height: 28 },
  name: { x: 126, y: 96, width: 320, height: 12 },
  capacity: { x: 126, y: 76, width: 320, height: 12 },
  date: { x: 126, y: 56, width: 260, height: 12 },
} as const;

const INK = rgb(0.05, 0.07, 0.1);
const RULE = rgb(0.84, 0.83, 0.82);

export function executionValueX() {
  return EXECUTION_LAYOUT.insetX + EXECUTION_LAYOUT.labelWidth;
}

export function executionPageNumber(agreementPageCount: number, totalPages: number) {
  return Math.max(1, Math.min(agreementPageCount, totalPages));
}

export function initialsPlacement(page: PageGeometry) {
  const width = Math.min(INITIALS_FIELD_LAYOUT.width, page.width);
  const height = Math.min(INITIALS_FIELD_LAYOUT.height, page.height);
  const maxX = Math.max(0, page.width - width);
  const maxY = Math.max(0, page.height - height);
  return {
    x: clamp(page.width - INITIALS_FIELD_LAYOUT.rightInset - width, 0, maxX),
    y: clamp(INITIALS_FIELD_LAYOUT.bottomOffset, 0, maxY),
    width,
    height,
  };
}

export async function overlayExecutionFrame(pdfBytes: Uint8Array, wording: string) {
  const document = await PDFDocument.load(pdfBytes);
  const pages = document.getPages();
  if (pages.length < 1) {
    return pdfBytes;
  }
  const page = pages[pages.length - 1];
  const times = await document.embedFont(StandardFonts.TimesRoman);
  const timesBold = await document.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await document.embedFont(StandardFonts.Helvetica);
  drawExecutionFrame(page, {
    wording,
    times,
    timesBold,
    helvetica,
  });
  return new Uint8Array(await document.save({ useObjectStreams: false }));
}

export function drawExecutionFrame(
  page: PDFPage,
  fonts: { wording: string; times: PDFFont; timesBold: PDFFont; helvetica: PDFFont },
) {
  const { width } = page.getSize();
  const inset = EXECUTION_LAYOUT.insetX;
  const lineEnd = Math.max(EXECUTION_LAYOUT.signature.x + 40, width - inset);

  page.drawText("Execution", {
    x: inset,
    y: EXECUTION_LAYOUT.heading.y,
    size: EXECUTION_LAYOUT.heading.size,
    font: fonts.timesBold,
    color: INK,
  });

  const maxWidth = Math.max(120, width - inset * 2);
  const lines = wrapPdfText(
    fonts.wording,
    fonts.times,
    EXECUTION_LAYOUT.wording.size,
    maxWidth,
  );
  lines.slice(0, 3).forEach((line, index) => {
    page.drawText(line, {
      x: inset,
      y: EXECUTION_LAYOUT.wording.y - index * EXECUTION_LAYOUT.wording.lineHeight,
      size: EXECUTION_LAYOUT.wording.size,
      font: fonts.times,
      color: INK,
    });
  });

  drawLabeledLine(page, "Signature:", EXECUTION_LAYOUT.signature.y, lineEnd, fonts.helvetica);
  drawLabeledLine(page, "Name:", EXECUTION_LAYOUT.name.y, lineEnd, fonts.helvetica);
  drawLabeledLine(page, "Capacity:", EXECUTION_LAYOUT.capacity.y, lineEnd, fonts.helvetica);
  drawLabeledLine(page, "Date:", EXECUTION_LAYOUT.date.y, lineEnd, fonts.helvetica);

  page.drawText(DROPBOX_SIGN_TEXT_TAGS.signature, {
    x: EXECUTION_LAYOUT.signature.x,
    y: EXECUTION_LAYOUT.signature.y,
    size: 6,
    font: fonts.helvetica,
    color: rgb(1, 1, 1),
  });
  page.drawText(DROPBOX_SIGN_TEXT_TAGS.name, {
    x: EXECUTION_LAYOUT.name.x,
    y: EXECUTION_LAYOUT.name.y,
    size: 6,
    font: fonts.helvetica,
    color: rgb(1, 1, 1),
  });
  page.drawText(DROPBOX_SIGN_TEXT_TAGS.date, {
    x: EXECUTION_LAYOUT.date.x,
    y: EXECUTION_LAYOUT.date.y,
    size: 6,
    font: fonts.helvetica,
    color: rgb(1, 1, 1),
  });
}

function drawLabeledLine(
  page: PDFPage,
  label: string,
  y: number,
  lineEnd: number,
  font: PDFFont,
) {
  page.drawText(label, {
    x: EXECUTION_LAYOUT.insetX,
    y,
    size: 10,
    font,
    color: INK,
  });
  page.drawLine({
    start: { x: executionValueX(), y: y - 1 },
    end: { x: lineEnd, y: y - 1 },
    thickness: 0.7,
    color: RULE,
  });
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}
