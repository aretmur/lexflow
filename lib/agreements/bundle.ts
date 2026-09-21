import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameFirm } from "@/lib/tenancy";
import { emptyDraft, emptyPricing } from "@/lib/agreements/draft";
import { VICTORIAN_TEMPLATES } from "@/lib/agreements/constants";
import {
  calculateShortFormPricing,
  calculateStagedPricing,
} from "@/lib/agreements/pricing";
import { freezeRequiredAttachment } from "@/lib/agreements/required-attachment";
import {
  shortFormPricingTypeFromMatter,
  snapshotPricingType,
} from "@/lib/agreements/short-form-pricing";
import { freezeSnapshot, type AgreementSnapshot } from "@/lib/agreements/snapshot";
import type { AgreementDraft } from "@/lib/validations";
import type {
  AgreementPricing,
  AgreementScopeItem,
  AgreementStage,
  Client,
  CostsAgreement,
  Firm,
  Matter,
  Practitioner,
  RequiredAttachment,
} from "@/lib/types/database";

export type AgreementBundle = {
  agreement: CostsAgreement;
  client: Client;
  matter: Matter;
  practitioner: Practitioner | null;
  pricing: AgreementPricing | null;
  stages: AgreementStage[];
  scopeItems: AgreementScopeItem[];
  attachment: RequiredAttachment | null;
  firm: Firm;
};

export async function loadAgreementBundle(
  firmId: string,
  agreementId: string,
): Promise<AgreementBundle | null> {
  const supabase = await createServerSupabaseClient();

  const { data: agreement } = await supabase
    .from("costs_agreements")
    .select("*")
    .eq("firm_id", firmId)
    .eq("id", agreementId)
    .maybeSingle();

  if (!agreement) {
    return null;
  }
  assertSameFirm(firmId, agreement.firm_id);

  const [{ data: matter }, { data: pricing }, { data: stages }, { data: scopeItems }, { data: firm }] =
    await Promise.all([
      supabase
        .from("matters")
        .select("*")
        .eq("firm_id", firmId)
        .eq("id", agreement.matter_id)
        .maybeSingle(),
      supabase
        .from("agreement_pricing")
        .select("*")
        .eq("firm_id", firmId)
        .eq("costs_agreement_id", agreement.id)
        .maybeSingle(),
      supabase
        .from("agreement_stages")
        .select("*")
        .eq("firm_id", firmId)
        .eq("costs_agreement_id", agreement.id)
        .order("position"),
      supabase
        .from("agreement_scope_items")
        .select("*")
        .eq("firm_id", firmId)
        .eq("costs_agreement_id", agreement.id)
        .order("position"),
      supabase.from("firms").select("*").eq("id", firmId).maybeSingle(),
    ]);

  if (!matter || !firm) {
    return null;
  }
  assertSameFirm(firmId, matter.firm_id);

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("firm_id", firmId)
    .eq("id", matter.client_id)
    .maybeSingle();

  if (!client) {
    return null;
  }

  let practitioner: Practitioner | null = null;
  if (matter.responsible_practitioner_id) {
    const { data } = await supabase
      .from("practitioners")
      .select("*")
      .eq("firm_id", firmId)
      .eq("id", matter.responsible_practitioner_id)
      .maybeSingle();
    practitioner = data;
  }

  let attachment: RequiredAttachment | null = null;
  const attachmentId = agreement.required_attachment_id;
  if (attachmentId) {
    const { data } = await supabase
      .from("required_attachments")
      .select("*")
      .eq("firm_id", firmId)
      .eq("id", attachmentId)
      .maybeSingle();
    attachment = data;
  }

  return {
    agreement,
    client,
    matter,
    practitioner,
    pricing,
    stages: stages ?? [],
    scopeItems: scopeItems ?? [],
    attachment,
    firm,
  };
}

export async function loadActiveRequiredAttachment(
  firmId: string,
): Promise<RequiredAttachment | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("required_attachments")
    .select("*")
    .eq("firm_id", firmId)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

export function bundleToDraft(bundle: AgreementBundle): AgreementDraft {
  const draft = emptyDraft(bundle.agreement.id, bundle.agreement.agreement_type);
  draft.client = {
    fullName: bundle.client.display_name === "New client" ? "" : bundle.client.display_name,
    email: bundle.client.email ?? "",
    phone: bundle.client.phone ?? "",
    addressLine1: bundle.client.address_line1 ?? "",
    suburb: bundle.client.suburb ?? "",
    state: bundle.client.state ?? "VIC",
    postcode: bundle.client.postcode ?? "",
  };
  draft.matter = {
    referenceNumber: bundle.matter.matter_number.startsWith("DRAFT-")
      ? ""
      : bundle.matter.matter_number,
    title: bundle.matter.matter_title === "New matter" ? "" : bundle.matter.matter_title,
    description: bundle.matter.matter_description ?? "",
    instructionsDate: bundle.matter.instructions_date ?? "",
    responsiblePractitionerId: bundle.matter.responsible_practitioner_id ?? "",
    pricingType: shortFormPricingTypeFromMatter(
      bundle.agreement.agreement_type,
      bundle.matter.pricing_type,
    ),
  };
  draft.generalScopeStatement = bundle.pricing?.general_scope_statement ?? "";
  draft.exclusions = bundle.pricing?.exclusions ?? "";
  draft.pricing = {
    ...emptyPricing(),
    ...(bundle.pricing
      ? {
          hourlyRateCents: bundle.pricing.hourly_rate_cents,
          professionalFeesExGstCents: bundle.pricing.professional_fees_ex_gst_cents,
          discountCents: bundle.pricing.discount_cents,
          disbursementsCents: bundle.pricing.disbursements_cents,
          miscellaneousFeesCents: bundle.pricing.miscellaneous_fees_cents,
          amountRequestedUpfrontCents: bundle.pricing.amount_requested_upfront_cents,
          principalLawyerRateCents: bundle.pricing.principal_lawyer_rate_cents,
          specialCounselRateCents: bundle.pricing.special_counsel_rate_cents,
          seniorLawyerRateCents: bundle.pricing.senior_lawyer_rate_cents,
          lawyerRateCents: bundle.pricing.lawyer_rate_cents,
          paralegalRateCents: bundle.pricing.paralegal_rate_cents,
          seniorCounselHourlyMinCents: bundle.pricing.senior_counsel_hourly_min_cents,
          seniorCounselHourlyMaxCents: bundle.pricing.senior_counsel_hourly_max_cents,
          seniorCounselDailyMinCents: bundle.pricing.senior_counsel_daily_min_cents,
          seniorCounselDailyMaxCents: bundle.pricing.senior_counsel_daily_max_cents,
          juniorCounselHourlyMinCents: bundle.pricing.junior_counsel_hourly_min_cents,
          juniorCounselHourlyMaxCents: bundle.pricing.junior_counsel_hourly_max_cents,
          juniorCounselDailyMinCents: bundle.pricing.junior_counsel_daily_min_cents,
          juniorCounselDailyMaxCents: bundle.pricing.junior_counsel_daily_max_cents,
        }
      : {}),
  };

  const agreementScope = bundle.scopeItems.filter((item) => !item.stage_id);
  if (agreementScope.length) {
    draft.scopeItems = agreementScope.map((item) => ({ id: item.id, body: item.body }));
  }

  if (bundle.stages.length) {
    draft.stages = bundle.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      timing: stage.timing ?? "",
      solicitorCostEstimateCents: stage.solicitor_cost_estimate_cents,
      consultantEstimateCents: stage.consultant_estimate_cents,
      notes: stage.notes ?? "",
      scopeItems: bundle.scopeItems
        .filter((item) => item.stage_id === stage.id)
        .map((item) => ({ id: item.id, body: item.body })),
    }));
  }

  return draft;
}

export function buildSnapshot(bundle: AgreementBundle, draft: AgreementDraft): AgreementSnapshot {
  const template = VICTORIAN_TEMPLATES[draft.agreementType];
  const shortForm = calculateShortFormPricing(draft.pricing);
  const staged = calculateStagedPricing({
    stages: draft.stages,
    disbursementsCents: draft.pricing.disbursementsCents,
    miscellaneousFeesCents: draft.pricing.miscellaneousFeesCents,
    amountRequestedUpfrontCents: draft.pricing.amountRequestedUpfrontCents,
  });

  return freezeSnapshot({
    capturedAt: new Date().toISOString(),
    template: {
      key: template.key,
      version: template.version,
      jurisdiction: template.jurisdiction,
      legalReview: true,
    },
    attachment: bundle.attachment ? freezeRequiredAttachment(bundle.attachment) : null,
    firm: {
      legalEntityName: bundle.firm.name,
      tradingName: bundle.firm.practice_name,
      abn: bundle.firm.abn,
      email: bundle.firm.email,
      phone: bundle.firm.phone,
      website: bundle.firm.website,
      jurisdiction: bundle.firm.jurisdiction,
      logoPath: bundle.firm.logo_path,
      addressLine1: bundle.firm.address_line1,
      addressLine2: bundle.firm.address_line2,
      suburb: bundle.firm.suburb,
      state: bundle.firm.state,
      postcode: bundle.firm.postcode,
      bankName: bundle.firm.bank_name,
      accountName: bundle.firm.account_name,
      bsb: bundle.firm.bsb,
      accountNumber: bundle.firm.account_number,
      paymentReferencePrefix: bundle.firm.payment_reference_prefix,
      cyberFraudContactPhone: bundle.firm.cyber_fraud_contact_phone,
    },
    practitioner: bundle.practitioner
      ? {
          fullName: bundle.practitioner.full_name,
          title: bundle.practitioner.title,
          email: bundle.practitioner.email,
          mobile: bundle.practitioner.mobile,
          defaultHourlyRateCents: bundle.practitioner.default_hourly_rate_cents,
        }
      : null,
    client: {
      fullName: draft.client.fullName.trim(),
      email: draft.client.email.trim() || null,
      phone: draft.client.phone.trim() || null,
      addressLine1: draft.client.addressLine1.trim() || null,
      addressLine2: null,
      suburb: draft.client.suburb.trim() || null,
      state: draft.client.state.trim() || null,
      postcode: draft.client.postcode.trim() || null,
    },
    matter: {
      referenceNumber: draft.matter.referenceNumber.trim(),
      title: draft.matter.title.trim(),
      description: draft.matter.description.trim() || null,
      instructionsDate: draft.matter.instructionsDate || null,
      jurisdiction: "VIC",
    },
    agreementType: draft.agreementType,
    pricingType: snapshotPricingType(draft.agreementType, draft.matter.pricingType),
    scopeItems: draft.scopeItems.map((item) => item.body.trim()).filter(Boolean),
    generalScopeStatement: draft.generalScopeStatement.trim() || null,
    exclusions: draft.exclusions.trim() || null,
    pricing:
      draft.agreementType === "short_form"
        ? {
            hourlyRateCents: draft.pricing.hourlyRateCents,
            professionalFeesExGstCents: draft.pricing.professionalFeesExGstCents,
            discountCents: draft.pricing.discountCents,
            disbursementsCents: draft.pricing.disbursementsCents,
            subtotalExGstCents: shortForm.subtotalExGstCents,
            gstCents: shortForm.gstCents,
            totalInclGstCents: shortForm.totalInclGstCents,
            amountRequestedUpfrontCents: shortForm.amountRequestedUpfrontCents,
          }
        : {
            disbursementsCents: draft.pricing.disbursementsCents,
            miscellaneousFeesCents: draft.pricing.miscellaneousFeesCents,
            solicitorTotalCents: staged.solicitorTotalCents,
            consultantTotalCents: staged.consultantTotalCents,
            gstCents: staged.gstCents,
            totalEstimateCents: staged.totalEstimateCents,
            amountRequestedUpfrontCents: staged.amountRequestedUpfrontCents,
            principalLawyerRateCents: draft.pricing.principalLawyerRateCents,
            specialCounselRateCents: draft.pricing.specialCounselRateCents,
            seniorLawyerRateCents: draft.pricing.seniorLawyerRateCents,
            lawyerRateCents: draft.pricing.lawyerRateCents,
            paralegalRateCents: draft.pricing.paralegalRateCents,
            seniorCounselHourlyMinCents: draft.pricing.seniorCounselHourlyMinCents,
            seniorCounselHourlyMaxCents: draft.pricing.seniorCounselHourlyMaxCents,
            seniorCounselDailyMinCents: draft.pricing.seniorCounselDailyMinCents,
            seniorCounselDailyMaxCents: draft.pricing.seniorCounselDailyMaxCents,
            juniorCounselHourlyMinCents: draft.pricing.juniorCounselHourlyMinCents,
            juniorCounselHourlyMaxCents: draft.pricing.juniorCounselHourlyMaxCents,
            juniorCounselDailyMinCents: draft.pricing.juniorCounselDailyMinCents,
            juniorCounselDailyMaxCents: draft.pricing.juniorCounselDailyMaxCents,
          },
    stages: draft.stages.map((stage, index) => ({
      stageNumber: index + 1,
      title: stage.title.trim(),
      timing: stage.timing.trim() || null,
      scopeItems: stage.scopeItems.map((item) => item.body.trim()).filter(Boolean),
      solicitorCostEstimateCents: stage.solicitorCostEstimateCents,
      consultantEstimateCents: stage.consultantEstimateCents,
      notes: stage.notes.trim() || null,
    })),
    amountRequestedUpfrontCents: draft.pricing.amountRequestedUpfrontCents,
  });
}
