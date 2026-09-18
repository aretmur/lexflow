import type { AgreementDraft } from "@/lib/validations";
import type { AgreementType } from "@/lib/agreements/constants";

export function newScopeItem(): AgreementDraft["scopeItems"][number] {
  return { id: crypto.randomUUID(), body: "" };
}

export function newStage(index: number): AgreementDraft["stages"][number] {
  return {
    id: crypto.randomUUID(),
    title: index === 0 ? "Stage 1" : "",
    timing: "",
    solicitorCostEstimateCents: 0,
    consultantEstimateCents: 0,
    notes: "",
    scopeItems: [newScopeItem()],
  };
}

export function emptyPricing(): AgreementDraft["pricing"] {
  return {
    hourlyRateCents: 0,
    professionalFeesExGstCents: 0,
    discountCents: 0,
    disbursementsCents: 0,
    miscellaneousFeesCents: 0,
    amountRequestedUpfrontCents: 0,
    principalLawyerRateCents: 0,
    specialCounselRateCents: 0,
    seniorLawyerRateCents: 0,
    lawyerRateCents: 0,
    paralegalRateCents: 0,
    seniorCounselHourlyMinCents: 0,
    seniorCounselHourlyMaxCents: 0,
    seniorCounselDailyMinCents: 0,
    seniorCounselDailyMaxCents: 0,
    juniorCounselHourlyMinCents: 0,
    juniorCounselHourlyMaxCents: 0,
    juniorCounselDailyMinCents: 0,
    juniorCounselDailyMaxCents: 0,
  };
}

export function emptyDraft(
  agreementId: string,
  agreementType: AgreementType,
): AgreementDraft {
  return {
    agreementId,
    agreementType,
    client: {
      fullName: "",
      email: "",
      phone: "",
      addressLine1: "",
      suburb: "",
      state: "VIC",
      postcode: "",
    },
    matter: {
      referenceNumber: "",
      title: "",
      description: "",
      instructionsDate: "",
      responsiblePractitionerId: "",
    },
    scopeItems: [newScopeItem()],
    generalScopeStatement: "",
    exclusions: "",
    pricing: emptyPricing(),
    stages: agreementType === "full_staged" ? [newStage(0)] : [],
  };
}
