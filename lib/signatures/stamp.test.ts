import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { sha256Hex } from "@/lib/documents/pdf/hash";
import { stampExecutedPdf } from "@/lib/signatures/stamp";
import { SignatureWorkflowError } from "@/lib/signatures/types";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function packPdf(pageCount: number) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }
  return document.save();
}

describe("executed PDF stamping", () => {
  it("stamps initials on every page and a signature on the last agreement page", async () => {
    const packBytes = new Uint8Array(await packPdf(3));
    const originalHash = sha256Hex(packBytes);
    const stamped = await stampExecutedPdf({
      packBytes,
      expectedSha256: originalHash,
      requirePageInitials: true,
      agreementPageCount: 2,
      initials: { kind: "type", text: "JS" },
      initialledPages: [1, 2, 3],
      signature: { kind: "type", text: "John Smith" },
      signerName: "John Smith",
      signedDate: "21 September 2026",
    });

    expect(sha256Hex(packBytes)).toBe(originalHash);
    expect(stamped.sha256).not.toBe(originalHash);
    expect(stamped.pageCount).toBe(3);
    const signed = await PDFDocument.load(stamped.bytes);
    expect(signed.getPageCount()).toBe(3);
  });

  it("accepts a drawn PNG mark and rejects a changed source pack", async () => {
    const packBytes = new Uint8Array(await packPdf(1));
    await expect(
      stampExecutedPdf({
        packBytes,
        expectedSha256: "abc",
        requirePageInitials: false,
        agreementPageCount: 1,
        initials: { kind: "type", text: "JS" },
        initialledPages: [],
        signature: { kind: "draw", pngBase64: PNG_1X1 },
        signerName: "John Smith",
        signedDate: "21 September 2026",
      }),
    ).rejects.toBeInstanceOf(SignatureWorkflowError);

    const stamped = await stampExecutedPdf({
      packBytes,
      expectedSha256: sha256Hex(packBytes),
      requirePageInitials: false,
      agreementPageCount: 1,
      initials: { kind: "type", text: "JS" },
      initialledPages: [],
      signature: { kind: "draw", pngBase64: PNG_1X1 },
      signerName: "John Smith",
      signedDate: "21 September 2026",
    });
    expect(stamped.sha256).toHaveLength(64);
  });

  it("requires every page to be initialled when that setting is on", async () => {
    const packBytes = new Uint8Array(await packPdf(2));
    await expect(
      stampExecutedPdf({
        packBytes,
        expectedSha256: sha256Hex(packBytes),
        requirePageInitials: true,
        agreementPageCount: 1,
        initials: { kind: "type", text: "JS" },
        initialledPages: [1],
        signature: { kind: "type", text: "John Smith" },
        signerName: "John Smith",
        signedDate: "21 September 2026",
      }),
    ).rejects.toBeInstanceOf(SignatureWorkflowError);
  });
});
