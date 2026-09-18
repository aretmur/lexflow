import { describe, expect, it } from "vitest";
import {
  calculateMatterFunding,
  daysOutstanding,
  notYetRequestedCents,
  outstandingRequestedFundsCents,
} from "@/lib/funding";

describe("matter funding definitions", () => {
  it("keeps agreed, requested, received, outstanding and not-yet-requested distinct", () => {
    const breakdown = calculateMatterFunding({
      agreedOrEstimatedCostCents: 2_000_000,
      fundsRequestedCents: 900_000,
      fundsReceivedCents: 750_000,
      fundsReceivedAgainstRequestsCents: 750_000,
    });

    expect(breakdown.agreedOrEstimatedCostCents).toBe(2_000_000);
    expect(breakdown.fundsRequestedCents).toBe(900_000);
    expect(breakdown.fundsReceivedCents).toBe(750_000);
    expect(breakdown.outstandingRequestedFundsCents).toBe(150_000);
    expect(breakdown.notYetRequestedCents).toBe(1_100_000);
  });

  it("does not let over-allocation create negative outstanding or not-yet-requested amounts", () => {
    expect(outstandingRequestedFundsCents(900_000, 1_000_000)).toBe(0);
    expect(notYetRequestedCents(900_000, 1_000_000)).toBe(0);
  });

  it("counts days outstanding from the request or due date", () => {
    expect(daysOutstanding("2026-09-08", new Date("2026-09-18T12:00:00"))).toBe(
      10,
    );
    expect(daysOutstanding("2026-09-18", new Date("2026-09-18T23:00:00"))).toBe(
      0,
    );
  });
});
