import { z } from "zod";
import { AGREEMENT_TYPES } from "@/lib/agreements/constants";
import {
  calculateShortFormPricing,
  calculateStagedPricing,
} from "@/lib/agreements/pricing";
import type { AgreementSnapshot } from "@/lib/agreements/snapshot";
import { gstCentsOnExclusive, type Cents } from "@/lib/money";
import { DocumentGenerationError } from "@/lib/documents/errors";
import type {
  ChargeOutRate,
  ConsultantRateRow,
  DocumentModel,
} from "@/lib/documents/document-types";
import {
  VIC_FULL_STAGED_TEMPLATE,
  VIC_SHORT_FORM_TEMPLATE,
} from "@/lib/documents/templates/vic/metadata";
import { formatDocumentDate } from "@/lib/documents/formatters";

const centsValue = z.number().int().nonnegative();

const snapshotSchema = z.object({
  capturedAt: z.string().min(1),
  template: z.object({
    key: z.string().min(1),
    version: z.string().min(1),
    jurisdiction: z.string().min(1),
    legalReview: z.literal(true),
  }),
  attachment: z
    .object({
      id: z.string().min(1),
      version: z.number().int().positive(),
      title: z.string().min(1),
      storagePath: z.string().min(1),
    })
    .nullable(),
  firm: z.object({
    legalEntityName: z.string(),
    tradingName: z.string().nullable(),
    abn: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    website: z.string().nullable(),
    jurisdiction: z.string(),
    logoPath: z.string().nullable(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    suburb: z.string().nullable(),
    state: z.string().nullable(),
    postcode: z.string().nullable(),
    bankName: z.string().nullable(),
    accountName: z.string().nullable(),
    bsb: z.string().nullable(),
    accountNumber: z.string().nullable(),
    paymentReferencePrefix: z.string().nullable(),
    cyberFraudContactPhone: z.string().nullable(),
  }),
  practitioner: z
    .object({
      fullName: z.string(),
      title: z.string().nullable(),
      email: z.string().nullable(),
      mobile: z.string().nullable(),
      defaultHourlyRateCents: centsValue,
    })
    .nullable(),
  client: z.object({
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    mobile: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    suburb: z.string().nullable(),
    state: z.string().nullable(),
    postcode: z.string().nullable(),
  }),
  matter: z.object({
    referenceNumber: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    instructionsDate: z.string().nullable(),
    jurisdiction: z.string(),
  }),
  agreementType: z.enum(AGREEMENT_TYPES),
  scopeItems: z.array(z.string()),
  generalScopeStatement: z.string().nullable(),
  exclusions: z.string().nullable(),
  pricing: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  stages: z.array(
    z.object({
      stageNumber: z.number().int().positive(),
      title: z.string(),
      timing: z.string().nullable(),
      scopeItems: z.array(z.string()),
      solicitorCostEstimateCents: centsValue,
      consultantEstimateCents: centsValue,
      notes: z.string().nullable(),
    }),
  ),
  amountRequestedUpfrontCents: centsValue,
});

function requiredCents(
  pricing: AgreementSnapshot["pricing"],
  key: string,
): Cents {
  const value = pricing[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new DocumentGenerationError(
      `Required pricing field ${key} is missing or invalid.`,
    );
  }
  return value;
}

function optionalCents(
  pricing: AgreementSnapshot["pricing"],
  key: string,
): Cents {
  const value = pricing[key];
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new DocumentGenerationError(
      `Pricing field ${key} is invalid.`,
    );
  }
  return value;
}

function assertMatch(label: string, frozen: Cents, canonical: Cents) {
  if (frozen !== canonical) {
    throw new DocumentGenerationError(
      `Frozen snapshot ${label} does not match the canonical calculation.`,
    );
  }
}

function chargeOutRates(pricing: AgreementSnapshot["pricing"]): ChargeOutRate[] {
  const rows: Array<{ position: string; key: string }> = [
    { position: "Principal Lawyer", key: "principalLawyerRateCents" },
    { position: "Special Counsel", key: "specialCounselRateCents" },
    { position: "Senior Lawyer", key: "seniorLawyerRateCents" },
    { position: "Lawyer", key: "lawyerRateCents" },
    { position: "Paralegal / Law Clerk", key: "paralegalRateCents" },
  ];
  return rows.map(({ position, key }) => {
    const exclusiveCents = optionalCents(pricing, key);
    return {
      position,
      exclusiveCents,
      inclusiveCents: exclusiveCents + gstCentsOnExclusive(exclusiveCents),
    };
  });
}

function consultantRates(pricing: AgreementSnapshot["pricing"]): ConsultantRateRow[] {
  const rows: ConsultantRateRow[] = [
    {
      label: "Senior Counsel",
      hourlyMinCents: optionalCents(pricing, "seniorCounselHourlyMinCents"),
      hourlyMaxCents: optionalCents(pricing, "seniorCounselHourlyMaxCents"),
      dailyMinCents: optionalCents(pricing, "seniorCounselDailyMinCents"),
      dailyMaxCents: optionalCents(pricing, "seniorCounselDailyMaxCents"),
    },
    {
      label: "Junior Counsel",
      hourlyMinCents: optionalCents(pricing, "juniorCounselHourlyMinCents"),
      hourlyMaxCents: optionalCents(pricing, "juniorCounselHourlyMaxCents"),
      dailyMinCents: optionalCents(pricing, "juniorCounselDailyMinCents"),
      dailyMaxCents: optionalCents(pricing, "juniorCounselDailyMaxCents"),
    },
  ];
  return rows.filter((row) =>
    [
      row.hourlyMinCents,
      row.hourlyMaxCents,
      row.dailyMinCents,
      row.dailyMaxCents,
    ].some((value) => value > 0),
  );
}

export function parseFrozenSnapshot(raw: unknown): AgreementSnapshot {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DocumentGenerationError("Frozen snapshot is missing or invalid.");
  }
  return parsed.data;
}

export function buildDocumentModel(
  raw: unknown,
  logoBytes: Uint8Array | null = null,
): DocumentModel {
  const snapshot = parseFrozenSnapshot(raw);

  if (snapshot.client.fullName.trim().length < 2) {
    throw new DocumentGenerationError("Mandatory client information is missing.");
  }
  if (snapshot.matter.referenceNumber.trim().length < 1) {
    throw new DocumentGenerationError("Matter reference is missing from the frozen snapshot.");
  }
  if (snapshot.matter.title.trim().length < 2) {
    throw new DocumentGenerationError("Matter title is missing from the frozen snapshot.");
  }
  if (!snapshot.practitioner?.fullName.trim()) {
    throw new DocumentGenerationError(
      "Responsible practitioner is missing from the frozen snapshot.",
    );
  }
  if (!snapshot.firm.legalEntityName.trim()) {
    throw new DocumentGenerationError("Law practice details are missing from the frozen snapshot.");
  }
  if (!snapshot.attachment) {
    throw new DocumentGenerationError("No required attachment is recorded on the frozen snapshot.");
  }

  const metadata =
    snapshot.agreementType === "short_form"
      ? VIC_SHORT_FORM_TEMPLATE
      : VIC_FULL_STAGED_TEMPLATE;

  if (snapshot.template.key !== metadata.templateKey) {
    throw new DocumentGenerationError("Frozen snapshot template key is not recognised.");
  }

  let shortForm: DocumentModel["shortForm"] = null;
  let staged: DocumentModel["staged"] = null;

  if (snapshot.agreementType === "short_form") {
    shortForm = calculateShortFormPricing({
      hourlyRateCents: requiredCents(snapshot.pricing, "hourlyRateCents"),
      professionalFeesExGstCents: requiredCents(
        snapshot.pricing,
        "professionalFeesExGstCents",
      ),
      discountCents: requiredCents(snapshot.pricing, "discountCents"),
      disbursementsCents: requiredCents(snapshot.pricing, "disbursementsCents"),
      amountRequestedUpfrontCents: requiredCents(
        snapshot.pricing,
        "amountRequestedUpfrontCents",
      ),
    });
    assertMatch("subtotal", requiredCents(snapshot.pricing, "subtotalExGstCents"), shortForm.subtotalExGstCents);
    assertMatch("GST", requiredCents(snapshot.pricing, "gstCents"), shortForm.gstCents);
    assertMatch(
      "total including GST",
      requiredCents(snapshot.pricing, "totalInclGstCents"),
      shortForm.totalInclGstCents,
    );
  } else {
    if (snapshot.stages.length < 1) {
      throw new DocumentGenerationError("The frozen snapshot has no stages.");
    }
    staged = calculateStagedPricing({
      stages: snapshot.stages,
      disbursementsCents: requiredCents(snapshot.pricing, "disbursementsCents"),
      miscellaneousFeesCents: requiredCents(
        snapshot.pricing,
        "miscellaneousFeesCents",
      ),
      amountRequestedUpfrontCents: requiredCents(
        snapshot.pricing,
        "amountRequestedUpfrontCents",
      ),
    });
    assertMatch(
      "solicitor total",
      requiredCents(snapshot.pricing, "solicitorTotalCents"),
      staged.solicitorTotalCents,
    );
    assertMatch(
      "consultant total",
      requiredCents(snapshot.pricing, "consultantTotalCents"),
      staged.consultantTotalCents,
    );
    assertMatch("GST", requiredCents(snapshot.pricing, "gstCents"), staged.gstCents);
    assertMatch(
      "total estimate",
      requiredCents(snapshot.pricing, "totalEstimateCents"),
      staged.totalEstimateCents,
    );
  }

  return {
    snapshot,
    metadata,
    capturedDate: formatDocumentDate(snapshot.capturedAt),
    shortForm,
    staged,
    chargeOutRates: snapshot.agreementType === "full_staged" ? chargeOutRates(snapshot.pricing) : [],
    consultants:
      snapshot.agreementType === "full_staged" ? consultantRates(snapshot.pricing) : [],
    logoBytes,
  };
}
