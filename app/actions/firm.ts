"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFirm, requireUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createFirmSchema,
  emptyToNull,
  firstIssue,
  updateFirmSchema,
  updatePaymentSchema,
  type FormActionState,
} from "@/lib/validations";
import { parseOptionalAudToCents } from "@/lib/money";

export async function createFirmAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();

  const parsed = createFirmSchema.safeParse({
    name: formData.get("name"),
    practiceName: formData.get("practiceName") || undefined,
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_firm", {
    p_name: parsed.data.name,
    p_practice_name: parsed.data.practiceName ?? parsed.data.name,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/agreements");
}

export async function updateFirmAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const context = await requireUser();
  if (!context.firm || !context.membership) {
    return { error: "Create a firm before updating its details." };
  }
  if (!["owner", "admin"].includes(context.membership.role)) {
    return { error: "Only a firm owner or administrator can update firm details." };
  }

  const parsed = updateFirmSchema.safeParse({
    name: formData.get("name"),
    practiceName: formData.get("practiceName") || undefined,
    abn: formData.get("abn") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    website: formData.get("website") || undefined,
    jurisdiction: formData.get("jurisdiction") || "VIC",
    addressLine1: formData.get("addressLine1") || undefined,
    addressLine2: formData.get("addressLine2") || undefined,
    suburb: formData.get("suburb") || undefined,
    state: formData.get("state") || undefined,
    postcode: formData.get("postcode") || undefined,
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("firms")
    .update({
      name: parsed.data.name,
      practice_name: emptyToNull(parsed.data.practiceName) ?? parsed.data.name,
      abn: emptyToNull(parsed.data.abn),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      website: emptyToNull(parsed.data.website),
      jurisdiction: parsed.data.jurisdiction,
      address_line1: emptyToNull(parsed.data.addressLine1),
      address_line2: emptyToNull(parsed.data.addressLine2),
      suburb: emptyToNull(parsed.data.suburb),
      state: emptyToNull(parsed.data.state),
      postcode: emptyToNull(parsed.data.postcode),
    })
    .eq("id", context.firm.id);

  if (error) {
    return { error: error.message };
  }

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(logo.type)) {
      return { error: "Logo must be a PNG, JPG or WebP file." };
    }
    const extension = logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
    const path = `${context.firm.id}/logo.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("firm-assets")
      .upload(path, logo, { upsert: true, contentType: logo.type });
    if (uploadError) {
      return { error: uploadError.message };
    }
    await supabase.from("firms").update({ logo_path: path }).eq("id", context.firm.id);
  }

  await supabase.from("audit_events").insert({
    firm_id: context.firm.id,
    actor_user_id: context.user.id,
    entity_type: "firm",
    entity_id: context.firm.id,
    action: "updated",
    payload: { name: parsed.data.name },
  });

  revalidatePath("/settings/firm");
  revalidatePath("/", "layout");
  return { message: "Firm details saved." };
}

export async function updatePaymentAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const context = await requireFirm();
  if (!["owner", "admin"].includes(context.membership.role)) {
    return { error: "Only a firm owner or administrator can update payment details." };
  }

  const parsed = updatePaymentSchema.safeParse({
    bankName: formData.get("bankName") || undefined,
    accountName: formData.get("accountName") || undefined,
    bsb: formData.get("bsb") || undefined,
    accountNumber: formData.get("accountNumber") || undefined,
    paymentReferencePrefix: formData.get("paymentReferencePrefix") || undefined,
    cyberFraudContactPhone: formData.get("cyberFraudContactPhone") || undefined,
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("firms")
    .update({
      bank_name: emptyToNull(parsed.data.bankName),
      account_name: emptyToNull(parsed.data.accountName),
      bsb: emptyToNull(parsed.data.bsb),
      account_number: emptyToNull(parsed.data.accountNumber),
      payment_reference_prefix: emptyToNull(parsed.data.paymentReferencePrefix),
      cyber_fraud_contact_phone: emptyToNull(parsed.data.cyberFraudContactPhone),
    })
    .eq("id", context.firm.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings/payment");
  return { message: "Payment details saved." };
}

export async function savePractitionerAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const context = await requireFirm();
  if (!["owner", "admin"].includes(context.membership.role)) {
    return { error: "Only a firm owner or administrator can change practitioners." };
  }

  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (fullName.length < 2) {
    return { error: "Practitioner name is required." };
  }

  let rateCents = 0;
  try {
    rateCents = parseOptionalAudToCents(String(formData.get("defaultHourlyRate") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid hourly rate." };
  }

  const supabase = await createServerSupabaseClient();
  const payload = {
    firm_id: context.firm.id,
    full_name: fullName,
    title: emptyToNull(String(formData.get("title") ?? "")),
    email: emptyToNull(String(formData.get("email") ?? "")),
    mobile: emptyToNull(String(formData.get("mobile") ?? "")),
    default_hourly_rate_cents: rateCents,
    is_active: formData.get("isActive") === "on",
  };

  const result = id
    ? await supabase.from("practitioners").update(payload).eq("id", id).eq("firm_id", context.firm.id)
    : await supabase.from("practitioners").insert(payload);

  if (result.error) {
    return { error: result.error.message };
  }

  revalidatePath("/settings/practitioners");
  return { message: "Practitioner saved." };
}
