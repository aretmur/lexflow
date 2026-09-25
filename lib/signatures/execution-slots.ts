import {
  PDFArray,
  PDFRawStream,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import { EXECUTION_LAYOUT, executionValueX } from "@/lib/signatures/execution-layout";

export type ExecutionSlot = {
  x: number;
  y: number;
};

export type ExecutionSlots = {
  pageIndex: number;
  signature: ExecutionSlot;
  name: ExecutionSlot;
  capacity: ExecutionSlot;
  date: ExecutionSlot;
};

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const LABELS = [
  ["Signature:", "signature"],
  ["Name:", "name"],
  ["Capacity:", "capacity"],
  ["Date:", "date"],
] as const;

export function fallbackExecutionSlots(pageIndex: number): ExecutionSlots {
  return {
    pageIndex,
    signature: { x: EXECUTION_LAYOUT.signature.x, y: EXECUTION_LAYOUT.signature.y },
    name: { x: EXECUTION_LAYOUT.name.x, y: EXECUTION_LAYOUT.name.y },
    capacity: { x: EXECUTION_LAYOUT.capacity.x, y: EXECUTION_LAYOUT.capacity.y },
    date: { x: EXECUTION_LAYOUT.date.x, y: EXECUTION_LAYOUT.date.y },
  };
}

export function findExecutionSlots(pages: PDFPage[]): ExecutionSlots | null {
  let bestPageIndex = -1;
  let bestFound: Partial<Record<(typeof LABELS)[number][1], ExecutionSlot>> = {};
  let bestCount = 0;
  pages.forEach((page, pageIndex) => {
    const found = slotsOnPage(decodePageContent(page));
    const count = LABELS.filter(([, key]) => found[key]).length;
    if (count > bestCount) {
      bestCount = count;
      bestPageIndex = pageIndex;
      bestFound = found;
    }
  });
  if (bestPageIndex < 0 || bestCount < 2) {
    return null;
  }
  const fallback = fallbackExecutionSlots(bestPageIndex);
  const signature = bestFound.signature ?? fallback.signature;
  const name = bestFound.name ?? fallback.name;
  const date = bestFound.date ?? fallback.date;
  const capacity =
    bestFound.capacity ??
    (bestFound.name && bestFound.date
      ? { x: name.x, y: (name.y + date.y) / 2 }
      : fallback.capacity);
  return {
    pageIndex: bestPageIndex,
    signature: { x: executionValueX(), y: signature.y },
    name: { x: executionValueX(), y: name.y },
    capacity: { x: executionValueX(), y: capacity.y },
    date: { x: executionValueX(), y: date.y },
  };
}

export function decodePageContent(page: PDFPage): string {
  const contents = page.node.Contents();
  if (!contents) {
    return "";
  }
  const objects = contents instanceof PDFArray ? contents.asArray() : [contents];
  let text = "";
  for (const object of objects) {
    const stream = page.doc.context.lookup(object);
    if (!stream) {
      continue;
    }
    if (stream instanceof PDFRawStream) {
      text += Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      continue;
    }
    const withUnencoded = stream as { getUnencodedContents?: () => Uint8Array };
    if (typeof withUnencoded.getUnencodedContents === "function") {
      text += Buffer.from(withUnencoded.getUnencodedContents()).toString("latin1");
      continue;
    }
    const withContents = stream as { getContents?: () => Uint8Array };
    if (typeof withContents.getContents === "function") {
      try {
        text += Buffer.from(decodePDFRawStream(stream as PDFRawStream).decode()).toString(
          "latin1",
        );
      } catch {
        text += Buffer.from(withContents.getContents()).toString("latin1");
      }
    }
  }
  return text;
}

function slotsOnPage(content: string) {
  const found: Partial<Record<(typeof LABELS)[number][1], ExecutionSlot>> = {};
  for (const shown of shownTexts(content)) {
    const text = shown.text.trim();
    for (const [label, key] of LABELS) {
      if (text === label) {
        found[key] = { x: shown.x, y: shown.y };
      }
    }
  }
  return found;
}

function shownTexts(content: string) {
  const items: Array<{ text: string; x: number; y: number }> = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = [...IDENTITY];
  let textMatrix: Matrix = [...IDENTITY];
  for (const { op, args } of pdfOperators(content)) {
    if (op === "q") {
      stack.push([...ctm]);
      continue;
    }
    if (op === "Q") {
      ctm = stack.pop() ?? [...IDENTITY];
      continue;
    }
    if (op === "cm") {
      const values = numbers(args);
      if (values.length >= 6) {
        ctm = multiply(ctm, values.slice(-6) as Matrix);
      }
      continue;
    }
    if (op === "BT") {
      textMatrix = [...IDENTITY];
      continue;
    }
    if (op === "Tm") {
      const values = numbers(args);
      if (values.length >= 6) {
        textMatrix = values.slice(-6) as Matrix;
      }
      continue;
    }
    if (op === "Td" || op === "TD") {
      const values = numbers(args);
      if (values.length >= 2) {
        const tx = values[values.length - 2];
        const ty = values[values.length - 1];
        textMatrix = multiply(textMatrix, [1, 0, 0, 1, tx, ty]);
      }
      continue;
    }
    if (op !== "Tj" && op !== "TJ" && op !== "'") {
      continue;
    }
    const text = decodeShow(args.at(-1) ?? "");
    if (!text) {
      continue;
    }
    const local = apply(textMatrix, 0, 0);
    const point = apply(ctm, local.x, local.y);
    items.push({ text, x: point.x, y: point.y });
  }
  return items;
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function apply(matrix: Matrix, x: number, y: number) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function numbers(args: string[]): number[] {
  return args.map(Number).filter((value) => Number.isFinite(value));
}

function decodeShow(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    let text = "";
    const pieces = trimmed.matchAll(/\((?:\\.|[^\\)])*\)|<[^>]*>/g);
    for (const piece of pieces) {
      text += decodeShow(piece[0]);
    }
    return text;
  }
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).replace(/\\([nrt\\()])/g, (_, ch: string) => {
      if (ch === "n") {
        return "\n";
      }
      if (ch === "r") {
        return "\r";
      }
      if (ch === "t") {
        return "\t";
      }
      return ch;
    });
  }
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    const hex = trimmed.slice(1, -1).replace(/\s+/g, "");
    if (!hex) {
      return "";
    }
    return Buffer.from(hex.length % 2 === 0 ? hex : `${hex}0`, "hex").toString("latin1");
  }
  return "";
}

function pdfOperators(content: string) {
  const ops: { op: string; args: string[] }[] = [];
  const args: string[] = [];
  let index = 0;
  while (index < content.length) {
    const char = content[index];
    if (char === "%") {
      const newline = content.indexOf("\n", index);
      index = newline === -1 ? content.length : newline + 1;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "/") {
      index += 1;
      while (index < content.length && !/[\s<>\[\]()/%]/.test(content[index])) {
        index += 1;
      }
      continue;
    }
    if (char === "(") {
      const { value, next } = readLiteral(content, index);
      args.push(value);
      index = next;
      continue;
    }
    if (char === "<") {
      const end = content.indexOf(">", index);
      if (end === -1) {
        break;
      }
      args.push(content.slice(index, end + 1));
      index = end + 1;
      continue;
    }
    if (char === "[") {
      const { value, next } = readArray(content, index);
      args.push(value);
      index = next;
      continue;
    }
    if (char === "+" || char === "-" || char === "." || (char >= "0" && char <= "9")) {
      const match = content.slice(index).match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
      args.push(match?.[0] ?? char);
      index += match?.[0].length ?? 1;
      continue;
    }
    let end = index;
    if (content[end] === "'" || content[end] === '"') {
      end += 1;
    } else {
      while (end < content.length && /[A-Za-z*]/.test(content[end])) {
        end += 1;
      }
    }
    if (end === index) {
      index += 1;
      args.length = 0;
      continue;
    }
    ops.push({ op: content.slice(index, end), args: [...args] });
    args.length = 0;
    index = end;
  }
  return ops;
}

function readLiteral(content: string, start: number) {
  let index = start + 1;
  let depth = 1;
  while (index < content.length && depth > 0) {
    if (content[index] === "\\") {
      index += 2;
      continue;
    }
    if (content[index] === "(") {
      depth += 1;
    } else if (content[index] === ")") {
      depth -= 1;
    }
    index += 1;
  }
  return { value: content.slice(start, index), next: index };
}

function readArray(content: string, start: number) {
  let index = start + 1;
  let depth = 1;
  while (index < content.length && depth > 0) {
    const char = content[index];
    if (char === "(") {
      index = readLiteral(content, index).next;
      continue;
    }
    if (char === "<") {
      const end = content.indexOf(">", index);
      index = end === -1 ? content.length : end + 1;
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
    }
    index += 1;
  }
  return { value: content.slice(start, index), next: index };
}
