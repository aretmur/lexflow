"use server";

import { revalidatePath } from "next/cache";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { REQUIRED_ATTACHMENT_TITLE } from "@/lib/agreements/constants";
import type { FormActionState } from "@/lib/validations";

export async function uploadRequiredAttachmentAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const context = await requireFirm();
  if (!["owner", "admin"].includes(context.membership.role)) {
    return { error: "Only a firm owner or administrator can upload the required attachment." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF to upload." };
  }
  if (file.type !== "application/pdf") {
    return { error: "The required attachment must be a PDF." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("required_attachments")
    .select("version")
    .eq("firm_id", context.firm.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (existing?.version ?? 0) + 1;
  const id = crypto.randomUUID();
  const path = `${context.firm.id}/${id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("required-attachments")
    .upload(path, file, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    return { error: uploadError.message };
  }

  await supabase
    .from("required_attachments")
    .update({ is_active: false })
    .eq("firm_id", context.firm.id)
    .eq("is_active", true);

  const { error } = await supabase.from("required_attachments").insert({
    id,
    firm_id: context.firm.id,
    title: REQUIRED_ATTACHMENT_TITLE,
    version,
    storage_path: path,
    original_filename: file.name,
    content_type: "application/pdf",
    byte_size: file.size,
    is_active: true,
    uploaded_by: context.user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings/attachment");
  revalidatePath("/agreements");
  return { message: `Version ${version} is now active. Previous versions stay on file for already frozen agreements.` };
}
