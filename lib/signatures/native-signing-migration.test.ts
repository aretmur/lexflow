import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260921150000_native_signing.sql"),
  "utf8",
);

describe("native signing migration", () => {
  it("does not update immutable generated packs", () => {
    expect(sql).not.toMatch(/update\s+public\.generated_agreement_packs/i);
    expect(sql).not.toMatch(/generated_packs_protect/i);
    expect(sql).not.toMatch(/alter\s+column\s+agreement_page_count\s+set\s+default/i);
    expect(sql).not.toMatch(/alter\s+column\s+attachment_page_count\s+set\s+default/i);
    expect(sql).not.toMatch(/alter\s+column\s+agreement_page_count\s+set\s+not\s+null/i);
    expect(sql).not.toMatch(/alter\s+column\s+attachment_page_count\s+set\s+not\s+null/i);
  });

  it("adds nullable page-split columns for legacy generated packs", () => {
    expect(sql).toMatch(
      /generated_agreement_packs[\s\S]*add column if not exists agreement_page_count integer/i,
    );
    expect(sql).toMatch(
      /generated_agreement_packs[\s\S]*add column if not exists attachment_page_count integer/i,
    );
  });
});
