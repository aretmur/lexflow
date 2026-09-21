import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(path);
    }
  }
  return acc;
}

describe("email secrets stay server-side", () => {
  it("does not import Resend or email credentials from client files", () => {
    const roots = ["app", "components"].map((dir) => join(process.cwd(), dir));
    const files = roots.flatMap((dir) => walk(dir));
    const clientFiles = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes('"use client"') || source.includes("'use client'");
    });
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/RESEND_API_KEY|lib\/email|from "resend"|from 'resend'/);
    }
  });
});
