import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260925020000_page_initials_default_off.sql"),
  "utf8",
);

describe("page initials default off", () => {
  it("changes the default for new firms without updating existing rows", () => {
    expect(sql).toMatch(/alter column require_page_initials set default false/i);
    expect(sql).not.toMatch(/update\s+public\.firms/i);
    expect(sql).not.toMatch(/update\s+public\.signature_requests/i);
  });
});
