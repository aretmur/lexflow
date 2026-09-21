import { PDFDocument } from "pdf-lib";
import { SignatureWorkflowError } from "@/lib/signatures/types";

/** Dropbox Sign first signer (client). */
export const DROPBOX_SIGN_CLIENT_SIGNER_INDEX = 0;

/**
 * Bottom-right initials placement in PDF points (1/72 inch).
 * Dropbox Sign coordinates originate at the bottom-left of the page.
 *
 * react-pdf footer sits at y=28 with 54pt side insets and a right-aligned
 * page number, so the field sits above that band.
 */
export const INITIALS_FIELD_LAYOUT = {
  width: 48,
  height: 18,
  rightInset: 54,
  bottomOffset: 46,
} as const;

export type PageGeometry = {
  page: number;
  width: number;
  height: number;
};

export type DropboxSignFormField = {
  api_id: string;
  name: string;
  type: "initials";
  x: number;
  y: number;
  width: number;
  height: number;
  required: true;
  signer: number;
  page: number;
};

export function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

export async function pageGeometriesFromPdf(bytes: Uint8Array): Promise<PageGeometry[]> {
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes);
  } catch {
    throw new SignatureWorkflowError("The generated agreement pack could not be read.");
  }

  const pages = document.getPages();
  if (pages.length < 1) {
    throw new SignatureWorkflowError("The generated agreement pack has no pages.");
  }

  return pages.map((page, index) => {
    const { width, height } = page.getSize();
    return { page: index + 1, width, height };
  });
}

export function placeInitialsField(page: PageGeometry): DropboxSignFormField {
  const width = Math.min(INITIALS_FIELD_LAYOUT.width, page.width);
  const height = Math.min(INITIALS_FIELD_LAYOUT.height, page.height);
  const maxX = Math.max(0, page.width - width);
  const maxY = Math.max(0, page.height - height);
  const x = clamp(page.width - INITIALS_FIELD_LAYOUT.rightInset - width, 0, maxX);
  const y = clamp(INITIALS_FIELD_LAYOUT.bottomOffset, 0, maxY);

  return {
    api_id: `client_initials_p${page.page}`,
    name: `Client initials page ${page.page}`,
    type: "initials",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    required: true,
    signer: DROPBOX_SIGN_CLIENT_SIGNER_INDEX,
    page: page.page,
  };
}

export function buildInitialsFields(pages: PageGeometry[]): DropboxSignFormField[] {
  return pages.map(placeInitialsField);
}

export function formFieldsPerDocument(
  pages: PageGeometry[],
  requirePageInitials: boolean,
): DropboxSignFormField[][] | undefined {
  if (!requirePageInitials || pages.length === 0) {
    return undefined;
  }
  return [buildInitialsFields(pages)];
}

export function fieldWithinPage(field: DropboxSignFormField, page: PageGeometry) {
  return (
    field.page === page.page &&
    field.x >= 0 &&
    field.y >= 0 &&
    field.x + field.width <= page.width + 0.01 &&
    field.y + field.height <= page.height + 0.01
  );
}
