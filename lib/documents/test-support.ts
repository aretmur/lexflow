import { freezeSnapshot, type AgreementSnapshot } from "@/lib/agreements/snapshot";
import {
  calculateShortFormPricing,
  calculateStagedPricing,
} from "@/lib/agreements/pricing";
import type { Cents } from "@/lib/money";

const firm: AgreementSnapshot["firm"] = {
  legalEntityName: "Octagon Legal Pty Ltd",
  tradingName: "Octagon Legal",
  abn: "12 345 678 901",
  email: "practice@example.com",
  phone: "03 9000 0000",
  website: null,
  jurisdiction: "VIC",
  logoPath: null,
  addressLine1: "1 Collins Street",
  addressLine2: null,
  suburb: "Melbourne",
  state: "VIC",
  postcode: "3000",
  bankName: "Example Bank",
  accountName: "Octagon Legal Trust Account",
  bsb: "063-000",
  accountNumber: "12345678",
  paymentReferencePrefix: "OCT",
  cyberFraudContactPhone: "03 9000 0000",
};

const client: AgreementSnapshot["client"] = {
  fullName: "Alex Client",
  email: "alex@example.com",
  phone: "0400 000 000",
  addressLine1: "10 Flinders Lane",
  addressLine2: null,
  suburb: "Melbourne",
  state: "VIC",
  postcode: "3000",
};

const practitioner: NonNullable<AgreementSnapshot["practitioner"]> = {
  fullName: "Pat Practitioner",
  title: "Principal",
  email: "pat@example.com",
  mobile: "0411 111 111",
  defaultHourlyRateCents: 40_000,
};

const attachment: NonNullable<AgreementSnapshot["attachment"]> = {
  id: "11111111-1111-1111-1111-111111111111",
  version: 2,
  title: "Legal Services Council Costs agreements Information sheet July 2022",
  storagePath: "firm/attachment.pdf",
};

export function shortFormSnapshot(
  overrides: Partial<AgreementSnapshot> = {},
  pricingOverrides: Record<string, Cents | string | null> = {},
): AgreementSnapshot {
  const pricingInput = {
    hourlyRateCents: 40_000,
    professionalFeesExGstCents: 300_000,
    discountCents: 20_000,
    disbursementsCents: 5_000,
    amountRequestedUpfrontCents: 150_000,
  };
  const calculated = calculateShortFormPricing(pricingInput);
  return freezeSnapshot({
    capturedAt: "2026-09-18T00:00:00.000Z",
    template: {
      key: "vic_short_form",
      version: "2026-09-under-legal-review",
      jurisdiction: "VIC",
      legalReview: true,
    },
    attachment,
    firm,
    practitioner,
    client,
    matter: {
      referenceNumber: "M-1001",
      title: "Advice on a contract",
      description: null,
      instructionsDate: "2026-09-01",
      jurisdiction: "VIC",
    },
    agreementType: "short_form",
    pricingType: "hourly",
    scopeItems: ["Advise on the contract", "Prepare a letter of advice"],
    generalScopeStatement: "Provide commercial legal advice.",
    exclusions: "Litigation",
    pricing: {
      ...pricingInput,
      subtotalExGstCents: calculated.subtotalExGstCents,
      gstCents: calculated.gstCents,
      totalInclGstCents: calculated.totalInclGstCents,
      ...pricingOverrides,
    },
    stages: [],
    amountRequestedUpfrontCents: calculated.amountRequestedUpfrontCents,
    ...overrides,
  });
}

export function stagedSnapshot(
  stageCount = 2,
  options: {
    longScope?: boolean;
    consultants?: boolean;
    disbursementsCents?: Cents;
  } = {},
): AgreementSnapshot {
  const stages = Array.from({ length: stageCount }, (_, index) => ({
    stageNumber: index + 1,
    title: `Stage ${index + 1}`,
    timing: index === 0 ? "Weeks 1–2" : null,
    scopeItems: options.longScope
      ? [
          `${"Review of the factual background, correspondence and source documents. ".repeat(8)} Stage ${index + 1}.`,
          `Further work item for stage ${index + 1} with additional detail so the row can wrap across the page.`,
        ]
      : [`Do the work for stage ${index + 1}`],
    solicitorCostEstimateCents: 200_000,
    consultantEstimateCents: index === 0 ? 50_000 : 0,
    notes: index === 0 ? "Depends on third-party records." : null,
  }));
  const calculated = calculateStagedPricing({
    stages,
    disbursementsCents: options.disbursementsCents ?? 20_000,
    miscellaneousFeesCents: 10_000,
    amountRequestedUpfrontCents: 100_000,
  });

  return freezeSnapshot({
    capturedAt: "2026-09-18T00:00:00.000Z",
    template: {
      key: "vic_full_staged",
      version: "2026-09-under-legal-review",
      jurisdiction: "VIC",
      legalReview: true,
    },
    attachment,
    firm,
    practitioner,
    client,
    matter: {
      referenceNumber: "M-2002",
      title: "Staged commercial matter",
      description: null,
      instructionsDate: "2026-09-01",
      jurisdiction: "VIC",
    },
    agreementType: "full_staged",
    pricingType: "staged_fixed_fee",
    scopeItems: options.longScope
      ? Array.from({ length: 20 }, (_, index) => `Scope item ${index + 1}: ${"detailed instructions ".repeat(12)}`)
      : ["Act generally in the matter"],
    generalScopeStatement: "Act in a staged commercial matter.",
    exclusions: "Tax advice",
    pricing: {
      disbursementsCents: options.disbursementsCents ?? 20_000,
      miscellaneousFeesCents: 10_000,
      solicitorTotalCents: calculated.solicitorTotalCents,
      consultantTotalCents: calculated.consultantTotalCents,
      gstCents: calculated.gstCents,
      totalEstimateCents: calculated.totalEstimateCents,
      amountRequestedUpfrontCents: calculated.amountRequestedUpfrontCents,
      principalLawyerRateCents: 55_000,
      specialCounselRateCents: 48_000,
      seniorLawyerRateCents: 40_000,
      lawyerRateCents: 32_000,
      paralegalRateCents: 18_000,
      ...(options.consultants
        ? {
            seniorCounselHourlyMinCents: 80_000,
            seniorCounselHourlyMaxCents: 120_000,
            seniorCounselDailyMinCents: 500_000,
            seniorCounselDailyMaxCents: 800_000,
            juniorCounselHourlyMinCents: 40_000,
            juniorCounselHourlyMaxCents: 60_000,
            juniorCounselDailyMinCents: 250_000,
            juniorCounselDailyMaxCents: 400_000,
          }
        : {
            seniorCounselHourlyMinCents: 0,
            seniorCounselHourlyMaxCents: 0,
            seniorCounselDailyMinCents: 0,
            seniorCounselDailyMaxCents: 0,
            juniorCounselHourlyMinCents: 0,
            juniorCounselHourlyMaxCents: 0,
            juniorCounselDailyMinCents: 0,
            juniorCounselDailyMaxCents: 0,
          }),
    },
    stages,
    amountRequestedUpfrontCents: calculated.amountRequestedUpfrontCents,
  });
}
