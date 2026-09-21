import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergeAgreementAndAttachment } from "@/lib/documents/pdf/merge-pdfs";
import {
  buildInitialsFields,
  fieldWithinPage,
  formFieldsPerDocument,
  INITIALS_FIELD_LAYOUT,
  pageGeometriesFromPdf,
  placeInitialsField,
} from "@/lib/signatures/form-fields";

const A4: [number, number] = [595.28, 841.89];

async function pdfWithPages(count: number, size: [number, number] = A4) {
  const document = await PDFDocument.create();
  for (let index = 0; index < count; index += 1) {
    document.addPage(size);
  }
  return document.save();
}

describe("per-page initials fields", () => {
  it("places one required initials field on a 1-page document", async () => {
    const pages = await pageGeometriesFromPdf(await pdfWithPages(1));
    const fields = buildInitialsFields(pages);

    expect(pages).toHaveLength(1);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      type: "initials",
      required: true,
      signer: 0,
      page: 1,
    });
    expect(fieldWithinPage(fields[0], pages[0])).toBe(true);
  });

  it("places one initials field on every page of an 8-page document", async () => {
    const pages = await pageGeometriesFromPdf(await pdfWithPages(8));
    const fields = buildInitialsFields(pages);

    expect(fields).toHaveLength(8);
    expect(fields.map((field) => field.page)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(fields.map((field) => field.api_id)).size).toBe(8);
    for (const field of fields) {
      expect(field.type).toBe("initials");
      expect(field.required).toBe(true);
      expect(field.signer).toBe(0);
      expect(fieldWithinPage(field, pages[field.page - 1])).toBe(true);
    }
  });

  it("places initials fields on appended LSC information-sheet pages", async () => {
    const agreement = await pdfWithPages(3);
    const informationSheet = await pdfWithPages(2, [612, 792]);
    const merged = await mergeAgreementAndAttachment(agreement, informationSheet);
    const pages = await pageGeometriesFromPdf(merged.bytes);
    const fields = buildInitialsFields(pages);

    expect(merged.agreementPageCount).toBe(3);
    expect(merged.attachmentPageCount).toBe(2);
    expect(pages).toHaveLength(5);
    expect(fields).toHaveLength(5);
    expect(pages[3]?.width).toBeCloseTo(612);
    expect(pages[4]?.height).toBeCloseTo(792);
    expect(fields[3]?.page).toBe(4);
    expect(fields[4]?.page).toBe(5);
    for (const field of fields) {
      expect(fieldWithinPage(field, pages[field.page - 1])).toBe(true);
    }
  });

  it("creates required fields when initials are on and none when off", () => {
    const pages = [
      { page: 1, width: 595.28, height: 841.89 },
      { page: 2, width: 595.28, height: 841.89 },
    ];

    const enabled = formFieldsPerDocument(pages, true);
    expect(enabled).toHaveLength(1);
    expect(enabled?.[0]).toHaveLength(2);
    expect(enabled?.[0].every((field) => field.required && field.type === "initials")).toBe(
      true,
    );

    expect(formFieldsPerDocument(pages, false)).toBeUndefined();
  });

  it("keeps coordinates inside page boundaries for differing geometry", () => {
    const tall = placeInitialsField({ page: 1, width: 595.28, height: 841.89 });
    const letter = placeInitialsField({ page: 2, width: 612, height: 792 });
    const small = placeInitialsField({ page: 3, width: 40, height: 20 });

    expect(
      fieldWithinPage(tall, { page: 1, width: 595.28, height: 841.89 }),
    ).toBe(true);
    expect(fieldWithinPage(letter, { page: 2, width: 612, height: 792 })).toBe(true);
    expect(fieldWithinPage(small, { page: 3, width: 40, height: 20 })).toBe(true);
    expect(tall.x).toBe(
      Math.round(595.28 - INITIALS_FIELD_LAYOUT.rightInset - INITIALS_FIELD_LAYOUT.width),
    );
    expect(tall.y).toBe(INITIALS_FIELD_LAYOUT.bottomOffset);
    expect(small.width).toBeLessThanOrEqual(40);
    expect(small.height).toBeLessThanOrEqual(20);
  });
});
