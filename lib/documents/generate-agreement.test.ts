import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DocumentGenerationError } from "@/lib/documents/errors";
import { buildDocumentModel } from "@/lib/documents/from-snapshot";
import { generateAgreementPackBytes } from "@/lib/documents/generate-agreement";
import { mergeAgreementAndAttachment } from "@/lib/documents/pdf/merge-pdfs";
import { generatedPackStoragePath } from "@/lib/documents/pdf/storage-path";
import { shortFormSnapshot, stagedSnapshot } from "@/lib/documents/test-support";

async function blankPdf(pageCount: number, size: [number, number] = [595.28, 841.89]) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage(size);
  }
  return document.save();
}

function pdfText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const chunks: string[] = [];
  let offset = 0;
  const startMarker = Buffer.from("stream");
  const endMarker = Buffer.from("endstream");

  while (offset < buffer.length) {
    const start = buffer.indexOf(startMarker, offset);
    if (start === -1) {
      break;
    }
    let dataStart = start + startMarker.length;
    if (buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }
    if (buffer[dataStart] === 0x0a) {
      dataStart += 1;
    }
    const end = buffer.indexOf(endMarker, dataStart);
    if (end === -1) {
      break;
    }
    let dataEnd = end;
    if (buffer[dataEnd - 1] === 0x0a) {
      dataEnd -= 1;
    }
    if (buffer[dataEnd - 1] === 0x0d) {
      dataEnd -= 1;
    }
    try {
      const inflated = inflateSync(buffer.subarray(dataStart, dataEnd)).toString("latin1");
      for (const match of inflated.matchAll(/<([0-9a-fA-F]+)>/g)) {
        chunks.push(Buffer.from(match[1], "hex").toString("latin1"));
      }
      for (const match of inflated.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
        chunks.push(match[0].slice(1, -1).replace(/\\(.)/g, "$1"));
      }
    } catch {
      // Skip non-Flate streams such as copied attachment objects.
    }
    offset = end + endMarker.length;
  }

  return chunks.join("");
}

describe("frozen snapshot validation", () => {
  it("fails when the required attachment is missing", () => {
    expect(() =>
      buildDocumentModel(shortFormSnapshot({ attachment: null })),
    ).toThrowError(DocumentGenerationError);
    expect(() =>
      buildDocumentModel(shortFormSnapshot({ attachment: null })),
    ).toThrow(/required attachment/i);
  });

  it("fails when client details are missing", () => {
    expect(() =>
      buildDocumentModel(
        shortFormSnapshot({
          client: {
            fullName: " ",
            email: null,
            phone: null,
            addressLine1: null,
            addressLine2: null,
            suburb: null,
            state: null,
            postcode: null,
          },
        }),
      ),
    ).toThrow(/client information/i);
  });

  it("fails when frozen GST does not match the canonical calculation", () => {
    expect(() =>
      buildDocumentModel(shortFormSnapshot({}, { gstCents: 1 })),
    ).toThrow(/canonical calculation/i);
  });

  it("fails when the snapshot itself is missing", () => {
    expect(() => buildDocumentModel(null)).toThrow(/snapshot is missing/i);
  });
});

describe("document versioning and immutability", () => {
  it("uses a distinct storage path for each version", () => {
    const version1 = generatedPackStoragePath({
      firmId: "firm-1",
      agreementId: "agreement-1",
      versionNumber: 1,
    });
    const version2 = generatedPackStoragePath({
      firmId: "firm-1",
      agreementId: "agreement-1",
      versionNumber: 2,
    });
    expect(version1).toBe("firm-1/agreement-1/version-1/agreement-pack.pdf");
    expect(version2).toBe("firm-1/agreement-1/version-2/agreement-pack.pdf");
    expect(version1).not.toBe(version2);
  });

  it("keeps the same path for a given version so a pack cannot be silently replaced", () => {
    const first = generatedPackStoragePath({
      firmId: "firm-1",
      agreementId: "agreement-1",
      versionNumber: 1,
    });
    const second = generatedPackStoragePath({
      firmId: "firm-1",
      agreementId: "agreement-1",
      versionNumber: 1,
    });
    expect(first).toBe(second);
  });
});

describe("attachment merge", () => {
  it("appends attachment pages after the generated agreement without changing page sizes", async () => {
    const agreement = await blankPdf(3);
    const attachment = await blankPdf(2, [400, 500]);
    const merged = await mergeAgreementAndAttachment(agreement, attachment);
    expect(merged.agreementPageCount).toBe(3);
    expect(merged.attachmentPageCount).toBe(2);
    expect(merged.pageCount).toBe(5);

    const document = await PDFDocument.load(merged.bytes);
    expect(document.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(document.getPage(3).getWidth()).toBe(400);
    expect(document.getPage(4).getHeight()).toBe(500);
  });
});

describe("short form generation", () => {
  it("renders canonical money values including discount, GST and disbursements", async () => {
    const attachment = await blankPdf(2, [400, 500]);
    const pack = await generateAgreementPackBytes({
      snapshot: shortFormSnapshot(),
      attachmentBytes: attachment,
    });

    expect(pack.templateKey).toBe("vic_short_form");
    expect(pack.templateVersion).toBe("2026-09-under-legal-review");
    expect(pack.requiredAttachmentVersion).toBe(2);
    expect(pack.pageCount).toBe(pack.agreementPageCount + pack.attachmentPageCount);
    expect(pack.sha256).toMatch(/^[a-f0-9]{64}$/);

    const text = pdfText(pack.bytes);
    expect(text.includes("UNDER LEGAL REVIEW")).toBe(true);
    expect(text.includes("$200.00")).toBe(true);
    expect(text.includes("$280.00")).toBe(true);
    expect(text.includes("$3,130.00")).toBe(true);
    expect(text.includes("$50.00")).toBe(true);
    expect(text.includes("Signature: ______________________")).toBe(true);

    const document = await PDFDocument.load(pack.bytes);
    const last = document.getPage(document.getPageCount() - 1);
    expect(last.getWidth()).toBe(400);
    expect(last.getHeight()).toBe(500);
  });

  it("renders zero disbursements as $0.00", async () => {
    const calculated = shortFormSnapshot({}, { disbursementsCents: 0, totalInclGstCents: 308_000 });
    const attachment = await blankPdf(1);
    const pack = await generateAgreementPackBytes({
      snapshot: calculated,
      attachmentBytes: attachment,
    });
    expect(pdfText(pack.bytes).includes("$0.00")).toBe(true);
  });
});

describe("full / staged generation", () => {
  it("renders one stage", async () => {
    const pack = await generateAgreementPackBytes({
      snapshot: stagedSnapshot(1),
      attachmentBytes: await blankPdf(1),
    });
    const text = pdfText(pack.bytes);
    expect(text.includes("Stage 1")).toBe(true);
    expect(text.includes("Stage 2")).toBe(false);
    expect(pack.templateKey).toBe("vic_full_staged");
  });

  it("renders multiple stages, GST and consultant rates", async () => {
    const pack = await generateAgreementPackBytes({
      snapshot: stagedSnapshot(3, { consultants: true }),
      attachmentBytes: await blankPdf(1),
    });
    const text = pdfText(pack.bytes);
    expect(text.includes("Stage 1")).toBe(true);
    expect(text.includes("Stage 3")).toBe(true);
    expect(text.includes("Senior Counsel")).toBe(true);
    expect(text.includes("$800.00")).toBe(true);
    expect(text.includes("$6,000.00")).toBe(true);
    expect(text.includes("Daily range")).toBe(true);
  });

  it("hides the consultants section when no consultant rates are supplied", async () => {
    const pack = await generateAgreementPackBytes({
      snapshot: stagedSnapshot(2),
      attachmentBytes: await blankPdf(1),
    });
    expect(pdfText(pack.bytes).includes("Daily range")).toBe(false);
  });

  it("handles long scope and ten or more stages without failing", async () => {
    const pack = await generateAgreementPackBytes({
      snapshot: stagedSnapshot(12, { longScope: true }),
      attachmentBytes: await blankPdf(2, [400, 500]),
    });
    expect(pack.agreementPageCount).toBeGreaterThan(1);
    expect(pack.pageCount).toBe(pack.agreementPageCount + 2);
    expect(pdfText(pack.bytes).includes("Stage 12")).toBe(true);
    const document = await PDFDocument.load(pack.bytes);
    const last = document.getPage(document.getPageCount() - 1);
    expect(last.getWidth()).toBe(400);
  });
});
