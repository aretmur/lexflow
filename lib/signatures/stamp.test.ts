import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
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
      // Skip image streams.
    }
    offset = end + endMarker.length;
  }

  return chunks.join("");
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
      signerCapacity: "Client",
    });

    expect(sha256Hex(packBytes)).toBe(originalHash);
    expect(stamped.sha256).not.toBe(originalHash);
    expect(stamped.pageCount).toBe(3);
    const signed = await PDFDocument.load(stamped.bytes);
    expect(signed.getPageCount()).toBe(3);
    const text = pdfText(stamped.bytes);
    expect(text).toContain("John Smith");
    expect(text).toContain("Client");
    expect(text).toContain("21 September 2026");
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
        signerCapacity: "Client",
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
      signerCapacity: "Client",
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
        signerCapacity: "Client",
      }),
    ).rejects.toBeInstanceOf(SignatureWorkflowError);
  });
});
