import { describe, expect, it } from "vitest";
import {
  addCents,
  assertCents,
  assertNonNegativeCents,
  centsToInputString,
  formatAudFromCents,
  interpretMoneyFieldText,
  MoneyError,
  parseAudToCents,
  subtractCents,
  sumCents,
} from "@/lib/money";

function parentCentsAfterTyping(startCents: number, typed: string) {
  let cents = startCents;
  let text = "";
  for (const character of typed) {
    text += character;
    const interpretation = interpretMoneyFieldText(text);
    if (interpretation.status === "valid") {
      cents = interpretation.cents;
    }
  }
  return { cents, text };
}

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

describe("MoneyField live parent updates", () => {
  it("updates parent cents before blur when the typed amount is valid", () => {
    const { cents } = parentCentsAfterTyping(0, "5000");
    expect(cents).toBe(500_000);
    expect(interpretMoneyFieldText("5000")).toEqual({ status: "valid", cents: 500_000 });
  });

  it("keeps incomplete decimal text without pushing a parent value", () => {
    expect(interpretMoneyFieldText("5.")).toEqual({ status: "incomplete" });
    expect(interpretMoneyFieldText(".")).toEqual({ status: "incomplete" });
  });

  it("does not silently zero the parent on invalid input", () => {
    const interpretation = interpretMoneyFieldText("abc");
    expect(interpretation.status).toBe("invalid");
    const previous = 500_000;
    const next =
      interpretation.status === "valid" ? interpretation.cents : previous;
    expect(next).toBe(500_000);
  });

  it("normalises valid amounts to the canonical currency input string on blur", () => {
    expect(centsToInputString(500_000)).toBe("5000");
    expect(centsToInputString(20_050)).toBe("200.50");
  });
});
