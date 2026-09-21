import { describe, expect, it } from "vitest";
import { emptyDraft } from "@/lib/agreements/draft";
import { bundleToDraft, buildSnapshot } from "@/lib/agreements/bundle";
import {
  applyShortFormPricingType,
  defaultShortFormPricingType,
  hourlyRateCentsForPersist,
  matterPricingTypeForDraft,
  shortFormPricingTypeFromMatter,
  shortFormReviewShowsHourlyRate,
  shouldPopulatePractitionerHourlyRate,
} from "@/lib/agreements/short-form-pricing";
import { agreementDraftSchema, agreementReadySchema } from "@/lib/validations";
import type { AgreementBundle } from "@/lib/agreements/bundle";

const AGREEMENT_ID = "33333333-3333-4333-a333-333333333333";

function draftWithFees(pricingType: "hourly" | "fixed_fee" = "hourly") {
  const draft = emptyDraft(AGREEMENT_ID, "short_form");
  draft.matter.pricingType = pricingType;
  draft.pricing.hourlyRateCents = pricingType === "hourly" ? 40_000 : 0;
  draft.pricing.professionalFeesExGstCents = 500_000;
  return draft;
}

describe("short-form costs basis", () => {
  it("new short form defaults to hourly", () => {
    expect(defaultShortFormPricingType()).toBe("hourly");
    expect(emptyDraft(AGREEMENT_ID, "short_form").matter.pricingType).toBe("hourly");
  });

  it("fixed fee can be selected", () => {
    const next = applyShortFormPricingType(draftWithFees("hourly"), "fixed_fee");
    expect(next.matter.pricingType).toBe("fixed_fee");
    expect(next.pricing.professionalFeesExGstCents).toBe(500_000);
  });

  it("hourly -> fixed clears hourly rate", () => {
    const next = applyShortFormPricingType(draftWithFees("hourly"), "fixed_fee");
    expect(next.pricing.hourlyRateCents).toBe(0);
    expect(hourlyRateCentsForPersist(next.matter.pricingType, next.pricing.hourlyRateCents)).toBe(
      0,
    );
  });

  it("fixed -> hourly enables rate", () => {
    const next = applyShortFormPricingType(draftWithFees("fixed_fee"), "hourly", 45_000);
    expect(next.matter.pricingType).toBe("hourly");
    expect(next.pricing.hourlyRateCents).toBe(45_000);
    expect(shouldPopulatePractitionerHourlyRate("hourly", 0)).toBe(true);
  });

  it("practitioner rate does not populate fixed fee mode", () => {
    expect(shouldPopulatePractitionerHourlyRate("fixed_fee", 0)).toBe(false);
    const selected = applyShortFormPricingType(draftWithFees("hourly"), "fixed_fee", 45_000);
    expect(selected.pricing.hourlyRateCents).toBe(0);
    const stillFixed = applyShortFormPricingType(selected, "fixed_fee", 45_000);
    expect(stillFixed.pricing.hourlyRateCents).toBe(0);
  });

  it("fixed_fee persists into matters.pricing_type", () => {
    expect(matterPricingTypeForDraft("short_form", "fixed_fee")).toBe("fixed_fee");
    expect(matterPricingTypeForDraft("short_form", "hourly")).toBe("hourly");
    expect(matterPricingTypeForDraft("full_staged", "fixed_fee")).toBe("staged_fixed_fee");
  });

  it("existing fixed_fee agreement reloads correctly", () => {
    expect(shortFormPricingTypeFromMatter("short_form", "fixed_fee")).toBe("fixed_fee");
    expect(shortFormPricingTypeFromMatter("short_form", "hourly")).toBe("hourly");

    const draft = bundleToDraft(fixedFeeBundle());
    expect(draft.matter.pricingType).toBe("fixed_fee");
    expect(draft.pricing.hourlyRateCents).toBe(0);
    expect(draft.pricing.professionalFeesExGstCents).toBe(500_000);
  });

  it("snapshot records pricingType", () => {
    const hourly = buildSnapshot(fixedFeeBundle(), draftWithFees("hourly"));
    expect(hourly.pricingType).toBe("hourly");
    const fixed = buildSnapshot(fixedFeeBundle(), draftWithFees("fixed_fee"));
    expect(fixed.pricingType).toBe("fixed_fee");
    expect(fixed.pricing.hourlyRateCents).toBe(0);
  });

  it("review screen hides hourly rate for fixed fee", () => {
    expect(shortFormReviewShowsHourlyRate("hourly")).toBe(true);
    expect(shortFormReviewShowsHourlyRate("fixed_fee")).toBe(false);
  });

  it("rejects a non-zero hourly rate on a fixed-fee ready draft", () => {
    const draft = draftWithFees("fixed_fee");
    draft.pricing.hourlyRateCents = 40_000;
    draft.client.fullName = "Alex Client";
    draft.matter.referenceNumber = "M-1";
    draft.matter.title = "Advice";
    draft.matter.responsiblePractitionerId = "66666666-6666-6666-6666-666666666666";
    draft.scopeItems[0].body = "Advise";
    const parsed = agreementDraftSchema.safeParse(draft);
    expect(parsed.success).toBe(true);
    expect(agreementReadySchema.safeParse(draft).success).toBe(false);
  });
});

function fixedFeeBundle(): AgreementBundle {
  const now = "2026-09-21T00:00:00.000Z";
  return {
    agreement: {
      id: AGREEMENT_ID,
      firm_id: "11111111-1111-1111-1111-111111111111",
      matter_id: "22222222-2222-2222-2222-222222222222",
      template_id: null,
      agreement_type: "short_form",
      jurisdiction: "VIC",
      template_key: "vic_short_form",
      template_version: "2026-09-under-legal-review",
      status: "draft",
      snapshot_frozen_at: null,
      required_attachment_id: null,
      created_at: now,
      updated_at: now,
    },
    client: {
      id: "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      firm_id: "11111111-1111-1111-1111-111111111111",
      display_name: "Alex Client",
      client_type: "individual",
      email: null,
      phone: null,
      address_line1: null,
      address_line2: null,
      suburb: null,
      state: "VIC",
      postcode: null,
      created_at: now,
      updated_at: now,
    },
    matter: {
      id: "22222222-2222-2222-2222-222222222222",
      firm_id: "11111111-1111-1111-1111-111111111111",
      client_id: "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      responsible_practitioner_id: null,
      matter_number: "M-1",
      matter_title: "Advice",
      matter_description: null,
      instructions_date: null,
      jurisdiction: "VIC",
      practice_area: null,
      pricing_type: "fixed_fee",
      agreed_or_estimated_cost_cents: 500_000,
      gst_treatment: "gst_exclusive",
      status: "draft",
      created_at: now,
      updated_at: now,
    },
    practitioner: null,
    pricing: {
      costs_agreement_id: AGREEMENT_ID,
      firm_id: "11111111-1111-1111-1111-111111111111",
      hourly_rate_cents: 0,
      professional_fees_ex_gst_cents: 500_000,
      discount_cents: 0,
      disbursements_cents: 0,
      miscellaneous_fees_cents: 0,
      amount_requested_upfront_cents: 0,
      subtotal_ex_gst_cents: 500_000,
      gst_cents: 50_000,
      total_incl_gst_cents: 550_000,
      total_estimate_cents: 0,
      principal_lawyer_rate_cents: 0,
      special_counsel_rate_cents: 0,
      senior_lawyer_rate_cents: 0,
      lawyer_rate_cents: 0,
      paralegal_rate_cents: 0,
      senior_counsel_hourly_min_cents: 0,
      senior_counsel_hourly_max_cents: 0,
      senior_counsel_daily_min_cents: 0,
      senior_counsel_daily_max_cents: 0,
      junior_counsel_hourly_min_cents: 0,
      junior_counsel_hourly_max_cents: 0,
      junior_counsel_daily_min_cents: 0,
      junior_counsel_daily_max_cents: 0,
      general_scope_statement: null,
      exclusions: null,
      created_at: now,
      updated_at: now,
    },
    stages: [],
    scopeItems: [],
    attachment: null,
    firm: {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Octagon Legal",
      practice_name: null,
      abn: null,
      email: null,
      phone: null,
      website: null,
      jurisdiction: "VIC",
      logo_path: null,
      address_line1: null,
      address_line2: null,
      suburb: null,
      state: null,
      postcode: null,
      bank_name: null,
      account_name: null,
      bsb: null,
      account_number: null,
      payment_reference_prefix: null,
      cyber_fraud_contact_phone: null,
      require_page_initials: true,
      created_at: now,
      updated_at: now,
    },
  };
}
