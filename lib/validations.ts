import { z } from "zod";
import { AGREEMENT_TYPES } from "@/lib/agreements/constants";
import { SHORT_FORM_PRICING_TYPES } from "@/lib/agreements/short-form-pricing";
import { JURISDICTIONS } from "@/lib/types/enums";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

export const firmNameSchema = z
  .string()
  .trim()
  .min(2, "Firm name must be at least 2 characters")
  .max(200, "Firm name is too long");

export const createFirmSchema = z.object({
  name: firmNameSchema,
  practiceName: z.string().trim().max(200).optional(),
});

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalEmail = z
  .union([z.literal(""), z.email("Enter a valid email address")])
  .optional();

export const updateFirmSchema = z.object({
  name: firmNameSchema,
  practiceName: optionalText(200),
  abn: optionalText(20),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalText(200),
  jurisdiction: z.enum(JURISDICTIONS),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  suburb: optionalText(100),
  state: optionalText(40),
  postcode: optionalText(12),
});

export const updateSigningSchema = z.object({
  requirePageInitials: z.enum(["true", "false"]),
});

export const updatePaymentSchema = z.object({
  bankName: optionalText(120),
  accountName: optionalText(200),
  bsb: optionalText(10),
  accountNumber: optionalText(20),
  paymentReferencePrefix: optionalText(40),
  cyberFraudContactPhone: optionalText(40),
});

export const practitionerSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, "Name is required").max(200),
  title: optionalText(120),
  email: optionalEmail,
  mobile: optionalText(40),
  defaultHourlyRate: optionalText(20),
  isActive: z.boolean().default(true),
});

export const agreementTypeSchema = z.enum(AGREEMENT_TYPES);

const centsSchema = z.number().int().nonnegative();

export const scopeItemDraftSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
});

export const stageDraftSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  timing: z.string(),
  solicitorCostEstimateCents: centsSchema,
  consultantEstimateCents: centsSchema,
  notes: z.string(),
  scopeItems: z.array(scopeItemDraftSchema),
});

export const agreementDraftSchema = z.object({
  agreementId: z.string().uuid(),
  agreementType: agreementTypeSchema,
  client: z.object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string(),
    addressLine1: z.string(),
    suburb: z.string(),
    state: z.string(),
    postcode: z.string(),
  }),
  matter: z.object({
    referenceNumber: z.string(),
    title: z.string(),
    description: z.string(),
    instructionsDate: z.string(),
    responsiblePractitionerId: z.string(),
    pricingType: z.enum(SHORT_FORM_PRICING_TYPES),
  }),
  scopeItems: z.array(scopeItemDraftSchema),
  generalScopeStatement: z.string(),
  exclusions: z.string(),
  pricing: z.object({
    hourlyRateCents: centsSchema,
    professionalFeesExGstCents: centsSchema,
    discountCents: centsSchema,
    disbursementsCents: centsSchema,
    miscellaneousFeesCents: centsSchema,
    amountRequestedUpfrontCents: centsSchema,
    principalLawyerRateCents: centsSchema,
    specialCounselRateCents: centsSchema,
    seniorLawyerRateCents: centsSchema,
    lawyerRateCents: centsSchema,
    paralegalRateCents: centsSchema,
    seniorCounselHourlyMinCents: centsSchema,
    seniorCounselHourlyMaxCents: centsSchema,
    seniorCounselDailyMinCents: centsSchema,
    seniorCounselDailyMaxCents: centsSchema,
    juniorCounselHourlyMinCents: centsSchema,
    juniorCounselHourlyMaxCents: centsSchema,
    juniorCounselDailyMinCents: centsSchema,
    juniorCounselDailyMaxCents: centsSchema,
  }),
  stages: z.array(stageDraftSchema),
});

export const agreementReadySchema = agreementDraftSchema.superRefine((draft, ctx) => {
  if (draft.client.fullName.trim().length < 2) {
    ctx.addIssue({ code: "custom", message: "Client name is required", path: ["client", "fullName"] });
  }
  if (draft.matter.referenceNumber.trim().length < 1) {
    ctx.addIssue({
      code: "custom",
      message: "Matter reference is required",
      path: ["matter", "referenceNumber"],
    });
  }
  if (draft.matter.title.trim().length < 2) {
    ctx.addIssue({ code: "custom", message: "Matter title is required", path: ["matter", "title"] });
  }
  if (!draft.matter.responsiblePractitionerId) {
    ctx.addIssue({
      code: "custom",
      message: "Responsible practitioner is required",
      path: ["matter", "responsiblePractitionerId"],
    });
  }

  const filledScope = draft.scopeItems.filter((item) => item.body.trim());
  if (draft.agreementType === "short_form" && filledScope.length < 1) {
    ctx.addIssue({ code: "custom", message: "Add at least one scope item", path: ["scopeItems"] });
  }
  if (draft.agreementType === "full_staged") {
    const filledStages = draft.stages.filter((stage) => stage.title.trim());
    if (filledStages.length < 1) {
      ctx.addIssue({ code: "custom", message: "Add at least one stage", path: ["stages"] });
    }
  }
  if (
    draft.agreementType === "short_form" &&
    draft.matter.pricingType === "fixed_fee" &&
    draft.pricing.hourlyRateCents !== 0
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Hourly rate must be zero for a fixed-fee agreement.",
      path: ["pricing", "hourlyRateCents"],
    });
  }
});

export type AgreementDraft = z.infer<typeof agreementDraftSchema>;

export type FormActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type SigningActionState = FormActionState & {
  signingUrl?: string;
  qrDataUrl?: string;
};

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function emptyToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
