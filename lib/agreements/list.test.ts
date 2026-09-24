import { describe, expect, it } from "vitest";
import {
  agreementMonthKey,
  canDiscardCostsAgreement,
  groupAgreementsByMonth,
} from "@/lib/agreements/list";

describe("agreement list grouping", () => {
  it("groups by Melbourne calendar month, newest month first", () => {
    const groups = groupAgreementsByMonth([
      { id: "jan", createdAt: "2026-01-15T02:00:00.000Z" },
      { id: "sep-early", createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "sep-late", createdAt: "2026-09-24T02:00:00.000Z" },
    ]);
    expect(groups.map((group) => group.label)).toEqual(["September 2026", "January 2026"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["sep-late", "sep-early"]);
  });

  it("uses Melbourne date, not UTC date, for the month key", () => {
    expect(agreementMonthKey("2026-08-31T14:30:00.000Z")).toBe("2026-09");
  });

  it("does not allow deleting a signed agreement", () => {
    expect(canDiscardCostsAgreement("draft")).toBe(true);
    expect(canDiscardCostsAgreement("generated")).toBe(true);
    expect(canDiscardCostsAgreement("sent")).toBe(true);
    expect(canDiscardCostsAgreement("signed")).toBe(false);
  });
});
