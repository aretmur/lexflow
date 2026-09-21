"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameFirm } from "@/lib/tenancy";
import { VICTORIAN_TEMPLATES, type AgreementType } from "@/lib/agreements/constants";
import {
  bundleToDraft,
  buildSnapshot,
  loadActiveRequiredAttachment,
  loadAgreementBundle,
} from "@/lib/agreements/bundle";
import {
  MISSING_ATTACHMENT_READY_ERROR,
  MissingRequiredAttachmentError,
  nextAgreementVersionNumber,
  reopenReadyAgreementStatus,
  requireActiveAttachment,
} from "@/lib/agreements/required-attachment";
import {
  calculateShortFormPricing,
  calculateStagedPricing,
  headlineTotalCents,
} from "@/lib/agreements/pricing";
import {
  agreementDraftSchema,
  agreementReadySchema,
  agreementTypeSchema,
  emptyToNull,
  firstIssue,
  type AgreementDraft,
  type FormActionState,
} from "@/lib/validations";
import {
  isNextNavigationError,
  logServerError,
  publicActionError,
} from "@/lib/server-log";

export async function createAgreementDraftAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = agreementTypeSchema.safeParse(formData.get("agreementType"));
  if (!parsed.success) {
    return { error: "Unable to create agreement: Choose an agreement type." };
  }

  try {
    const id = await createAgreementDraft(parsed.data);
    revalidatePath("/agreements");
    redirect(`/agreements/${id}/edit`);
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : undefined;
    return {
      error: `Unable to create agreement: ${publicActionError(
        message,
        "The agreement could not be created.",
      )}`,
    };
  }
}

export async function createAgreementDraft(type: AgreementType) {
  const { firm, user } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_agreement_draft", {
    p_agreement_type: type,
  });

  if (error || !data) {
    logServerError("create_agreement_draft", {
      step: "rpc",
      code: error?.code,
      message: error?.message,
      agreementType: type,
      hasFirm: Boolean(firm.id),
      hasUser: Boolean(user.id),
    });
    throw new Error(error?.message ?? "The agreement could not be created.");
  }

  return data;
}

export async function saveAgreementDraftAction(payload: unknown) {
  const parsed = agreementDraftSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const error = await persistDraft(parsed.data);
  if (error) {
    return { error };
  }

  revalidatePath(`/agreements/${parsed.data.agreementId}`);
  revalidatePath("/agreements");
  return { ok: true };
}

export async function markAgreementReadyAction(payload: unknown) {
  const parsed = agreementReadySchema.safeParse(payload);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { firm, user } = await requireFirm();
  let activeAttachment;
  try {
    activeAttachment = requireActiveAttachment(
      await loadActiveRequiredAttachment(firm.id),
    );
  } catch (error) {
    if (error instanceof MissingRequiredAttachmentError) {
      return { error: MISSING_ATTACHMENT_READY_ERROR };
    }
    throw error;
  }

  const persistError = await persistDraft(parsed.data);
  if (persistError) {
    return { error: persistError };
  }

  const bundle = await loadAgreementBundle(firm.id, parsed.data.agreementId);
  if (!bundle) {
    return { error: "Agreement not found." };
  }

  bundle.attachment = activeAttachment;
  const snapshot = buildSnapshot(bundle, parsed.data);

  const supabase = await createServerSupabaseClient();
  const { data: lastVersion } = await supabase
    .from("agreement_versions")
    .select("version_number")
    .eq("firm_id", firm.id)
    .eq("costs_agreement_id", parsed.data.agreementId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastVersion) {
    await supabase
      .from("agreement_versions")
      .update({ status: "superseded" })
      .eq("firm_id", firm.id)
      .eq("costs_agreement_id", parsed.data.agreementId)
      .eq("status", "issued");
  }

  const { error: versionError } = await supabase.from("agreement_versions").insert({
    firm_id: firm.id,
    costs_agreement_id: parsed.data.agreementId,
    version_number: nextAgreementVersionNumber(lastVersion?.version_number),
    status: "issued",
    snapshot: snapshot as unknown as Record<string, unknown>,
    executed_at: null,
  });

  if (versionError) {
    return { error: versionError.message };
  }

  const { error: statusError } = await supabase
    .from("costs_agreements")
    .update({
      status: "ready",
      snapshot_frozen_at: new Date().toISOString(),
      required_attachment_id: activeAttachment.id,
    })
    .eq("id", parsed.data.agreementId)
    .eq("firm_id", firm.id);

  if (statusError) {
    return { error: statusError.message };
  }

  if (activeAttachment && !activeAttachment.used_at) {
    await supabase
      .from("required_attachments")
      .update({ used_at: new Date().toISOString() })
      .eq("id", activeAttachment.id)
      .eq("firm_id", firm.id);
  }

  await supabase.from("audit_events").insert({
    firm_id: firm.id,
    actor_user_id: user.id,
    entity_type: "costs_agreement",
    entity_id: parsed.data.agreementId,
    action: "marked_ready",
    payload: { template: snapshot.template },
  });

  revalidatePath(`/agreements/${parsed.data.agreementId}`);
  revalidatePath("/agreements");
  return { ok: true };
}

export async function reopenAgreementDraftAction(agreementId: string) {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: agreement } = await supabase
    .from("costs_agreements")
    .select("id, firm_id, status")
    .eq("id", agreementId)
    .eq("firm_id", firm.id)
    .maybeSingle();

  if (!agreement) {
    return { error: "Agreement not found." };
  }
  assertSameFirm(firm.id, agreement.firm_id);

  const draftStatus = reopenReadyAgreementStatus(agreement.status);
  if (draftStatus) {
    await supabase
      .from("costs_agreements")
      .update({ status: draftStatus })
      .eq("id", agreementId)
      .eq("firm_id", firm.id);
  }

  redirect(`/agreements/${agreementId}/edit`);
}

async function persistDraft(draft: AgreementDraft) {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const bundle = await loadAgreementBundle(firm.id, draft.agreementId);
  if (!bundle) {
    return "Agreement not found.";
  }
  if (!["draft", "ready"].includes(bundle.agreement.status)) {
    return "This agreement can no longer be edited.";
  }

  const displayName = draft.client.fullName.trim() || "New client";
  const matterNumber =
    draft.matter.referenceNumber.trim() || bundle.matter.matter_number;
  const matterTitle = draft.matter.title.trim() || "New matter";
  const shortForm = calculateShortFormPricing(draft.pricing);
  const staged = calculateStagedPricing({
    stages: draft.stages,
    disbursementsCents: draft.pricing.disbursementsCents,
    miscellaneousFeesCents: draft.pricing.miscellaneousFeesCents,
    amountRequestedUpfrontCents: draft.pricing.amountRequestedUpfrontCents,
  });
  const headline = headlineTotalCents(draft.agreementType, shortForm, staged);
  const practitionerId = emptyToNull(draft.matter.responsiblePractitionerId);

  if (practitionerId) {
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("id, firm_id")
      .eq("id", practitionerId)
      .eq("firm_id", firm.id)
      .maybeSingle();
    if (!practitioner) {
      return "Practitioner not found in this firm.";
    }
  }

  const { error: clientError } = await supabase
    .from("clients")
    .update({
      display_name: displayName,
      email: emptyToNull(draft.client.email),
      phone: emptyToNull(draft.client.phone),
      address_line1: emptyToNull(draft.client.addressLine1),
      suburb: emptyToNull(draft.client.suburb),
      state: emptyToNull(draft.client.state) ?? "VIC",
      postcode: emptyToNull(draft.client.postcode),
    })
    .eq("id", bundle.client.id)
    .eq("firm_id", firm.id);

  if (clientError) {
    return clientError.message;
  }

  const { error: matterError } = await supabase
    .from("matters")
    .update({
      matter_number: matterNumber,
      matter_title: matterTitle,
      matter_description: emptyToNull(draft.matter.description),
      instructions_date: emptyToNull(draft.matter.instructionsDate),
      responsible_practitioner_id: practitionerId,
      agreed_or_estimated_cost_cents: headline,
      pricing_type: draft.agreementType === "short_form" ? "hourly" : "staged_fixed_fee",
    })
    .eq("id", bundle.matter.id)
    .eq("firm_id", firm.id);

  if (matterError) {
    return matterError.message;
  }

  const { error: agreementError } = await supabase
    .from("costs_agreements")
    .update({
      status: "draft",
      agreement_type: draft.agreementType,
      template_key: VICTORIAN_TEMPLATES[draft.agreementType].key,
      template_version: VICTORIAN_TEMPLATES[draft.agreementType].version,
    })
    .eq("id", draft.agreementId)
    .eq("firm_id", firm.id);

  if (agreementError) {
    return agreementError.message;
  }

  const { error: pricingError } = await supabase
    .from("agreement_pricing")
    .update({
      hourly_rate_cents: draft.pricing.hourlyRateCents,
      professional_fees_ex_gst_cents: draft.pricing.professionalFeesExGstCents,
      discount_cents: draft.pricing.discountCents,
      disbursements_cents: draft.pricing.disbursementsCents,
      miscellaneous_fees_cents: draft.pricing.miscellaneousFeesCents,
      amount_requested_upfront_cents: draft.pricing.amountRequestedUpfrontCents,
      subtotal_ex_gst_cents: shortForm.subtotalExGstCents,
      gst_cents:
        draft.agreementType === "short_form" ? shortForm.gstCents : staged.gstCents,
      total_incl_gst_cents: shortForm.totalInclGstCents,
      total_estimate_cents: staged.totalEstimateCents,
      principal_lawyer_rate_cents: draft.pricing.principalLawyerRateCents,
      special_counsel_rate_cents: draft.pricing.specialCounselRateCents,
      senior_lawyer_rate_cents: draft.pricing.seniorLawyerRateCents,
      lawyer_rate_cents: draft.pricing.lawyerRateCents,
      paralegal_rate_cents: draft.pricing.paralegalRateCents,
      senior_counsel_hourly_min_cents: draft.pricing.seniorCounselHourlyMinCents,
      senior_counsel_hourly_max_cents: draft.pricing.seniorCounselHourlyMaxCents,
      senior_counsel_daily_min_cents: draft.pricing.seniorCounselDailyMinCents,
      senior_counsel_daily_max_cents: draft.pricing.seniorCounselDailyMaxCents,
      junior_counsel_hourly_min_cents: draft.pricing.juniorCounselHourlyMinCents,
      junior_counsel_hourly_max_cents: draft.pricing.juniorCounselHourlyMaxCents,
      junior_counsel_daily_min_cents: draft.pricing.juniorCounselDailyMinCents,
      junior_counsel_daily_max_cents: draft.pricing.juniorCounselDailyMaxCents,
      general_scope_statement: emptyToNull(draft.generalScopeStatement),
      exclusions: emptyToNull(draft.exclusions),
    })
    .eq("costs_agreement_id", draft.agreementId)
    .eq("firm_id", firm.id);

  if (pricingError) {
    return pricingError.message;
  }

  await supabase
    .from("agreement_scope_items")
    .delete()
    .eq("costs_agreement_id", draft.agreementId)
    .eq("firm_id", firm.id);
  await supabase
    .from("agreement_stages")
    .delete()
    .eq("costs_agreement_id", draft.agreementId)
    .eq("firm_id", firm.id);

  if (draft.agreementType === "full_staged" && draft.stages.length) {
    const { error: stageError } = await supabase.from("agreement_stages").insert(
      draft.stages.map((stage, index) => ({
        id: stage.id,
        firm_id: firm.id,
        costs_agreement_id: draft.agreementId,
        position: index,
        stage_number: index + 1,
        title: stage.title.trim() || `Stage ${index + 1}`,
        timing: emptyToNull(stage.timing),
        solicitor_cost_estimate_cents: stage.solicitorCostEstimateCents,
        consultant_estimate_cents: stage.consultantEstimateCents,
        notes: emptyToNull(stage.notes),
      })),
    );
    if (stageError) {
      return stageError.message;
    }
  }

  const scopeRows = [
    ...draft.scopeItems
      .filter((item) => item.body.trim())
      .map((item, index) => ({
        id: item.id,
        firm_id: firm.id,
        costs_agreement_id: draft.agreementId,
        stage_id: null,
        position: index,
        body: item.body.trim(),
      })),
    ...(draft.agreementType === "full_staged"
      ? draft.stages.flatMap((stage, stageIndex) =>
          stage.scopeItems
            .filter((item) => item.body.trim())
            .map((item, index) => ({
              id: item.id,
              firm_id: firm.id,
              costs_agreement_id: draft.agreementId,
              stage_id: stage.id,
              position: stageIndex * 100 + index,
              body: item.body.trim(),
            })),
        )
      : []),
  ];

  if (scopeRows.length) {
    const { error: scopeError } = await supabase
      .from("agreement_scope_items")
      .insert(scopeRows);
    if (scopeError) {
      return scopeError.message;
    }
  }

  return null;
}

export async function loadDraftAction(agreementId: string) {
  const { firm } = await requireFirm();
  const bundle = await loadAgreementBundle(firm.id, agreementId);
  if (!bundle) {
    return null;
  }
  return bundleToDraft(bundle);
}
