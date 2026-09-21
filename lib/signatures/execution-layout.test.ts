import { describe, expect, it } from "vitest";
import { executionPageNumber } from "@/lib/signatures/execution-layout";

describe("execution page", () => {
  it("uses agreement_page_count, not the total pack page_count", () => {
    expect(executionPageNumber(3, 5)).toBe(3);
    expect(executionPageNumber(3, 5)).not.toBe(5);
    expect(executionPageNumber(1, 8)).toBe(1);
  });
});
