import { describe, expect, it } from "vitest";
import {
  addCents,
  assertCents,
  assertNonNegativeCents,
  formatAudFromCents,
  MoneyError,
  parseAudToCents,
  subtractCents,
  sumCents,
} from "@/lib/money";

describe("money utilities", () => {
  it("treats $5,000.00 as 500000 cents", () => {
    expect(parseAudToCents("$5,000.00")).toBe(500_000);
    expect(formatAudFromCents(500_000)).toBe("$5,000.00");
  });

  it("parses whole dollars and one decimal place", () => {
    expect(parseAudToCents("20")).toBe(2_000);
    expect(parseAudToCents("20.5")).toBe(2_050);
  });

  it("adds and subtracts using integer cents only", () => {
    expect(addCents(900_000, 100_000)).toBe(1_000_000);
    expect(subtractCents(900_000, 750_000)).toBe(150_000);
    expect(sumCents([100, 250, 50])).toBe(400);
  });

  it("rejects floating-point values", () => {
    expect(() => assertCents(100.5)).toThrow(MoneyError);
    expect(() => assertNonNegativeCents(-1)).toThrow(MoneyError);
    expect(() => parseAudToCents("20.555")).toThrow(MoneyError);
    expect(() => parseAudToCents("abc")).toThrow(MoneyError);
  });

  it("formats negative values without using floating point", () => {
    expect(formatAudFromCents(-150)).toBe("-$1.50");
    expect(formatAudFromCents(0)).toBe("$0.00");
  });
});
