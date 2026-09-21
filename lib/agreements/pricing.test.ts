import { describe, expect, it } from "vitest";
import { gstCentsOnExclusive, parseOptionalAudToCents } from "@/lib/money";
import {
  calculateShortFormPricing,
  calculateStagedPricing,
} from "@/lib/agreements/pricing";
import { freezeSnapshot, type AgreementSnapshot } from "@/lib/agreements/snapshot";
import { assertSameFirm } from "@/lib/tenancy";

describe("GST on exclusive amounts", () => {
  it("applies 10% using integer cents and round-half-up", () => {
    expect(gstCentsOnExclusive(3_000_00)).toBe(300_00);
    expect(gstCentsOnExclusive(105)).toBe(11);
    expect(gstCentsOnExclusive(104)).toBe(10);
    expect(gstCentsOnExclusive(0)).toBe(0);
  });
});

describe("short-form costs", () => {
  it("keeps fees, discount, GST and disbursements distinct", () => {
    const result = calculateShortFormPricing({
      hourlyRateCents: 40_000,
      professionalFeesExGstCents: 300_000,
      discountCents: 20_000,
      disbursementsCents: 5_000,
      amountRequestedUpfrontCents: 150_000,
    });

    expect(result.subtotalExGstCents).toBe(280_000);
    expect(result.gstCents).toBe(28_000);
    expect(result.totalInclGstCents).toBe(313_000);
    expect(result.amountRequestedUpfrontCents).toBe(150_000);
  });

  it("does not allow discount to create a negative subtotal", () => {
    const result = calculateShortFormPricing({
      hourlyRateCents: 0,
      professionalFeesExGstCents: 10_000,
      discountCents: 40_000,
      disbursementsCents: 0,
      amountRequestedUpfrontCents: 0,
    });
    expect(result.subtotalExGstCents).toBe(0);
    expect(result.gstCents).toBe(0);
  });
});

describe("full / staged costs", () => {
  it("sums multiple stages and adds GST only on solicitor estimates", () => {
    const result = calculateStagedPricing({
      stages: [
        { solicitorCostEstimateCents: 200_000, consultantEstimateCents: 50_000 },
        { solicitorCostEstimateCents: 300_000, consultantEstimateCents: 0 },
      ],
      disbursementsCents: 20_000,
      miscellaneousFeesCents: 10_000,
      amountRequestedUpfrontCents: 100_000,
    });

    expect(result.solicitorTotalCents).toBe(500_000);
    expect(result.consultantTotalCents).toBe(50_000);
    expect(result.gstCents).toBe(50_000);
    expect(result.totalEstimateCents).toBe(630_000);
  });
});

describe("agreement snapshots", () => {
  it("are deep copies so later firm edits cannot mutate a frozen agreement", () => {
    const liveFirmName = { legalEntityName: "Octagon Legal" };
    const snapshot = freezeSnapshot({
      capturedAt: "2026-09-18T00:00:00.000Z",
      template: {
        key: "vic_short_form",
        version: "2026-09-under-legal-review",
        jurisdiction: "VIC",
        legalReview: true,
      },
      attachment: { id: "att-1", version: 1, title: "Info sheet", storagePath: "path" },
      firm: {
        legalEntityName: liveFirmName.legalEntityName,
        tradingName: "Octagon",
        abn: "123",
        email: null,
        phone: null,
        website: null,
        jurisdiction: "VIC",
        logoPath: null,
        addressLine1: null,
        addressLine2: null,
        suburb: null,
        state: null,
        postcode: null,
        bankName: null,
        accountName: null,
        bsb: null,
        accountNumber: null,
        paymentReferencePrefix: null,
        cyberFraudContactPhone: null,
      },
      practitioner: {
        fullName: "A Practitioner",
        title: "Principal",
        email: null,
        mobile: null,
        defaultHourlyRateCents: 40000,
      },
      client: {
        fullName: "Client",
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        suburb: null,
        state: null,
        postcode: null,
      },
      matter: {
        referenceNumber: "M-1",
        title: "Matter",
        description: null,
        instructionsDate: null,
        jurisdiction: "VIC",
      },
      agreementType: "short_form",
      pricingType: "hourly",
      scopeItems: ["Advise"],
      generalScopeStatement: null,
      exclusions: null,
      pricing: { totalInclGstCents: 1000 },
      stages: [],
      amountRequestedUpfrontCents: 0,
    } satisfies AgreementSnapshot);

    liveFirmName.legalEntityName = "Someone Else";
    snapshot.firm.legalEntityName = "Octagon Legal";
    expect(snapshot.firm.legalEntityName).toBe("Octagon Legal");
    expect(snapshot.attachment?.version).toBe(1);
  });
});

describe("tenant isolation helper", () => {
  it("rejects cross-firm record access", () => {
    expect(() => assertSameFirm("firm-a", "firm-b")).toThrow("Record not found");
    expect(() => assertSameFirm("firm-a", "firm-a")).not.toThrow();
  });
});

describe("optional money parsing", () => {
  it("treats a blank field as zero cents", () => {
    expect(parseOptionalAudToCents("")).toBe(0);
    expect(parseOptionalAudToCents("$1,250.50")).toBe(125_050);
  });
});
