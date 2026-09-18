"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createFirmSchema,
  emptyToNull,
  firstIssue,
  updateFirmSchema,
  type FormActionState,
} from "@/lib/validations";

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
  redirect("/dashboard");
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
  return {};
}
