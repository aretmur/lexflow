import {
  addCents,
  assertNonNegativeCents,
  gstCentsOnExclusive,
  subtractCents,
  sumCents,
  type Cents,
} from "@/lib/money";
import type { AgreementType } from "@/lib/agreements/constants";

export type StageCostInput = {
  solicitorCostEstimateCents: Cents;
  consultantEstimateCents: Cents;
};

export type ShortFormPricingInput = {
  hourlyRateCents: Cents;
  professionalFeesExGstCents: Cents;
  discountCents: Cents;
  disbursementsCents: Cents;
  amountRequestedUpfrontCents: Cents;
};

export type StagedPricingInput = {
  stages: readonly StageCostInput[];
  disbursementsCents: Cents;
  miscellaneousFeesCents: Cents;
  amountRequestedUpfrontCents: Cents;
};

export type ShortFormPricingResult = {
  subtotalExGstCents: Cents;
  gstCents: Cents;
  totalInclGstCents: Cents;
  amountRequestedUpfrontCents: Cents;
};

export type StagedPricingResult = {
  solicitorTotalCents: Cents;
  consultantTotalCents: Cents;
  gstCents: Cents;
  totalEstimateCents: Cents;
  amountRequestedUpfrontCents: Cents;
};

export function calculateShortFormPricing(
  input: ShortFormPricingInput,
): ShortFormPricingResult {
  const fees = assertNonNegativeCents(
    input.professionalFeesExGstCents,
    "estimated professional fees",
  );
  const discount = assertNonNegativeCents(input.discountCents, "discount");
  const disbursements = assertNonNegativeCents(
    input.disbursementsCents,
    "disbursements",
  );
  const difference = subtractCents(fees, discount);
  const subtotalExGstCents = difference < 0 ? 0 : difference;
  const gstCents = gstCentsOnExclusive(subtotalExGstCents);
  const totalInclGstCents = sumCents([subtotalExGstCents, gstCents, disbursements]);

  return {
    subtotalExGstCents,
    gstCents,
    totalInclGstCents,
    amountRequestedUpfrontCents: assertNonNegativeCents(
      input.amountRequestedUpfrontCents,
      "amount requested upfront",
    ),
  };
}

export function calculateStagedPricing(
  input: StagedPricingInput,
): StagedPricingResult {
  const solicitorTotalCents = sumCents(
    input.stages.map((stage) =>
      assertNonNegativeCents(stage.solicitorCostEstimateCents, "solicitor estimate"),
    ),
  );
  const consultantTotalCents = sumCents(
    input.stages.map((stage) =>
      assertNonNegativeCents(stage.consultantEstimateCents, "consultant estimate"),
    ),
  );
  const gstCents = gstCentsOnExclusive(solicitorTotalCents);
  const totalEstimateCents = sumCents([
    solicitorTotalCents,
    gstCents,
    consultantTotalCents,
    assertNonNegativeCents(input.disbursementsCents, "disbursements"),
    assertNonNegativeCents(input.miscellaneousFeesCents, "miscellaneous fees"),
  ]);

  return {
    solicitorTotalCents,
    consultantTotalCents,
    gstCents,
    totalEstimateCents,
    amountRequestedUpfrontCents: assertNonNegativeCents(
      input.amountRequestedUpfrontCents,
      "amount requested upfront",
    ),
  };
}

export function headlineTotalCents(
  type: AgreementType,
  shortForm: ShortFormPricingResult,
  staged: StagedPricingResult,
): Cents {
  return type === "short_form"
    ? shortForm.totalInclGstCents
    : staged.totalEstimateCents;
}

export function addStageTotals(
  left: StageCostInput,
  right: StageCostInput,
): StageCostInput {
  return {
    solicitorCostEstimateCents: addCents(
      left.solicitorCostEstimateCents,
      right.solicitorCostEstimateCents,
    ),
    consultantEstimateCents: addCents(
      left.consultantEstimateCents,
      right.consultantEstimateCents,
    ),
  };
}
