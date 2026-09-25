import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { overlayExecutionFrame } from "@/lib/signatures/execution-layout";
import { decodePageContent, findExecutionSlots } from "@/lib/signatures/execution-slots";
import { stampExecutedPdf } from "@/lib/signatures/stamp";
import { sha256Hex } from "@/lib/documents/pdf/hash";

function yBefore(content: string, needle: string) {
  const hex = `<${Buffer.from(needle, "latin1").toString("hex")}>`;
  const idx = Math.max(
    content.lastIndexOf(`(${needle})`),
    content.toLowerCase().lastIndexOf(hex.toLowerCase()),
  );
  expect(idx).toBeGreaterThan(-1);
  const before = content.slice(Math.max(0, idx - 400), idx);
  const tm = [...before.matchAll(/([0-9.-]+)\s+([0-9.-]+)\s+Tm/g)].at(-1);
  const cm = [...before.matchAll(/1\s+0\s+0\s+1\s+([0-9.-]+)\s+([0-9.-]+)\s+cm/g)].at(-1);
  const td = [...before.matchAll(/([0-9.-]+)\s+([0-9.-]+)\s+Td/g)].at(-1);
  const pair = tm ?? cm ?? td;
  expect(pair).toBeTruthy();
  return Number(pair![2]);
}

async function stampOn(packBytes: Uint8Array) {
  return stampExecutedPdf({
    packBytes,
    expectedSha256: sha256Hex(packBytes),
    requirePageInitials: false,
    agreementPageCount: 1,
    initials: { kind: "type", text: "AM" },
    initialledPages: [],
    signature: { kind: "type", text: "A Muradyan" },
    signerName: "aret muradyan",
    signedDate: "25 September 2026",
    signerCapacity: "Client",
  });
}

describe("execution slot finder", () => {
  it("reads overlay execution line coordinates", async () => {
    const document = await PDFDocument.create();
    document.addPage([595.28, 841.89]);
    const framed = await overlayExecutionFrame(
      new Uint8Array(await document.save()),
      "By signing below you acknowledge that you have received this costs agreement.",
    );
    const loaded = await PDFDocument.load(framed);
    const slots = findExecutionSlots(loaded.getPages());
    expect(slots).toEqual({
      pageIndex: 0,
      signature: { x: 126, y: 118 },
      name: { x: 126, y: 96 },
      capacity: { x: 126, y: 76 },
      date: { x: 126, y: 56 },
    });
  });

  it("finds flow-layout Execution labels high on the page and stamps on those lines", async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([595.28, 841.89]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    const labels = [
      ["Signature:", 428],
      ["Name:", 404],
      ["Capacity:", 380],
      ["Date:", 356],
    ] as const;
    for (const [label, y] of labels) {
      page.drawText(label, { x: 54, y, size: 10, font, color: rgb(0, 0, 0) });
      page.drawLine({
        start: { x: 126, y: y - 1 },
        end: { x: 540, y: y - 1 },
        thickness: 0.7,
        color: rgb(0.8, 0.8, 0.8),
      });
    }
    const packBytes = new Uint8Array(await document.save({ useObjectStreams: false }));
    const loaded = await PDFDocument.load(packBytes);
    expect(findExecutionSlots(loaded.getPages())?.signature.y).toBe(428);
    expect(findExecutionSlots(loaded.getPages())?.date.y).toBe(356);

    const stamped = await stampOn(packBytes);
    const stream = decodePageContent((await PDFDocument.load(stamped.bytes)).getPages()[0]);
    expect(yBefore(stream, "A Muradyan")).toBeCloseTo(429, 0);
    expect(yBefore(stream, "Name:")).toBeCloseTo(404, 0);
    expect(yBefore(stream, "aret muradyan")).toBeCloseTo(404, 0);
    expect(yBefore(stream, "Client")).toBeCloseTo(380, 0);
    expect(yBefore(stream, "25 September 2026")).toBeCloseTo(356, 0);
  });

  it("stamps onto react-pdf Execution blanks that sit in document flow", async () => {
    const row = (label: string) =>
      createElement(
        View,
        {
          style: {
            flexDirection: "row",
            alignItems: "flex-end",
            marginTop: 10,
            width: 400,
          },
        },
        createElement(Text, { style: { width: 72, fontSize: 10 } }, label),
        createElement(View, {
          style: { flexGrow: 1, borderBottomWidth: 1, borderBottomColor: "#d6d3d1", height: 14 },
        }),
      );
    const bytes = new Uint8Array(
      await renderToBuffer(
        createElement(
          Document,
          null,
          createElement(
            Page,
            {
              size: "A4",
              style: { padding: 54, fontSize: 10, fontFamily: "Times-Roman" },
            },
            createElement(Text, { style: { fontFamily: "Times-Bold", fontSize: 13 } }, "Your rights"),
            createElement(
              Text,
              null,
              "You have rights under the Legal Profession Uniform Law, including rights to negotiate this agreement.",
            ),
            createElement(
              Text,
              { style: { fontFamily: "Times-Bold", fontSize: 13, marginTop: 14 } },
              "Execution",
            ),
            createElement(
              Text,
              { style: { fontSize: 9, marginBottom: 8 } },
              "By signing below you acknowledge that you have received this costs agreement.",
            ),
            row("Signature:"),
            row("Name:"),
            row("Capacity:"),
            row("Date:"),
          ),
        ),
      ),
    );
    const loaded = await PDFDocument.load(bytes);
    const slots = findExecutionSlots(loaded.getPages());
    expect(slots).not.toBeNull();
    expect(slots!.signature.y).toBeGreaterThan(200);
    expect(slots!.name.y).toBeLessThan(slots!.signature.y);
    expect(slots!.date.y).toBeLessThan(slots!.capacity.y);

    const stamped = await stampOn(bytes);
    const stream = decodePageContent((await PDFDocument.load(stamped.bytes)).getPages()[0]);
    expect(yBefore(stream, "aret muradyan")).toBeCloseTo(slots!.name.y, 1);
    expect(yBefore(stream, "Client")).toBeCloseTo(slots!.capacity.y, 1);
    expect(yBefore(stream, "25 September 2026")).toBeCloseTo(slots!.date.y, 1);
  });
});
