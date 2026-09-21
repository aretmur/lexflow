import type { AgreementType } from "@/lib/agreements/constants";
import type { PricingType } from "@/lib/types/enums";

export const SHORT_FORM_PRICING_TYPES = ["hourly", "fixed_fee"] as const;
export type ShortFormPricingType = (typeof SHORT_FORM_PRICING_TYPES)[number];

export function defaultShortFormPricingType(): ShortFormPricingType {
  return "hourly";
}

export function shortFormPricingTypeFromMatter(
  agreementType: AgreementType,
  matterPricingType: string | null | undefined,
): ShortFormPricingType {
  if (agreementType !== "short_form") {
    return "hourly";
  }
  return matterPricingType === "fixed_fee" ? "fixed_fee" : "hourly";
}

export function matterPricingTypeForDraft(
  agreementType: AgreementType,
  pricingType: ShortFormPricingType | undefined,
): PricingType {
  if (agreementType === "full_staged") {
    return "staged_fixed_fee";
  }
  return pricingType === "fixed_fee" ? "fixed_fee" : "hourly";
}

export function snapshotPricingType(
  agreementType: AgreementType,
  pricingType: ShortFormPricingType | undefined,
): PricingType {
  return matterPricingTypeForDraft(agreementType, pricingType);
}

export function shouldPopulatePractitionerHourlyRate(
  pricingType: ShortFormPricingType,
  hourlyRateCents: number,
): boolean {
  return pricingType === "hourly" && hourlyRateCents === 0;
}

export function applyShortFormPricingType<
  T extends {
    matter: { pricingType: ShortFormPricingType };
    pricing: { hourlyRateCents: number };
  },
>(
  draft: T,
  next: ShortFormPricingType,
  practitionerDefaultRateCents = 0,
): T {
  if (next === "fixed_fee") {
    return {
      ...draft,
      matter: { ...draft.matter, pricingType: "fixed_fee" },
      pricing: { ...draft.pricing, hourlyRateCents: 0 },
    };
  }

  const hourlyRateCents = shouldPopulatePractitionerHourlyRate("hourly", draft.pricing.hourlyRateCents)
    ? practitionerDefaultRateCents
    : draft.pricing.hourlyRateCents;

  return {
    ...draft,
    matter: { ...draft.matter, pricingType: "hourly" },
    pricing: { ...draft.pricing, hourlyRateCents },
  };
}

export function hourlyRateCentsForPersist(
  pricingType: ShortFormPricingType,
  hourlyRateCents: number,
): number {
  return pricingType === "fixed_fee" ? 0 : hourlyRateCents;
}

export function shortFormBasisLabel(pricingType: ShortFormPricingType): string {
  return pricingType === "fixed_fee" ? "Fixed fee" : "Hourly";
}

export function shortFormFeeLabel(pricingType: ShortFormPricingType): string {
  return pricingType === "fixed_fee"
    ? "Fixed professional fee excl GST"
    : "Estimated professional fees excl GST";
}

export function shortFormReviewShowsHourlyRate(pricingType: ShortFormPricingType): boolean {
  return pricingType === "hourly";
}
