"use server";

import { revalidatePath } from "next/cache";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameFirm } from "@/lib/tenancy";
import { DocumentGenerationError } from "@/lib/documents/errors";
import { generateAgreementPackBytes } from "@/lib/documents/generate-agreement";
import {
  GENERATED_AGREEMENTS_BUCKET,
  generatedPackStoragePath,
} from "@/lib/documents/pdf/storage-path";
import {
  downloadPrivateFile,
  loadLatestIssuedVersion,
  loadPackForVersion,
} from "@/lib/agreements/packs";
import type { AgreementSnapshot } from "@/lib/agreements/snapshot";

async function markGenerated(firmId: string, agreementId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("costs_agreements")
    .update({ status: "generated" })
    .eq("id", agreementId)
    .eq("firm_id", firmId)
    .eq("status", "ready");
  if (error) {
    throw new DocumentGenerationError(error.message);
  }
}

export async function generateAgreementAction(agreementId: string) {
  try {
    const { firm, user } = await requireFirm();
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

    if (agreement.status === "draft") {
      return { error: "Mark the agreement ready before generating." };
    }
    if (!["ready", "generated"].includes(agreement.status)) {
      return { error: "This agreement can no longer be generated." };
    }

    const version = await loadLatestIssuedVersion(firm.id, agreementId);
    if (!version) {
      return { error: "Frozen snapshot is missing." };
    }

    const existingPack = await loadPackForVersion(firm.id, version.id);
    if (existingPack) {
      if (agreement.status === "ready") {
        await markGenerated(firm.id, agreementId);
      }
      revalidatePath(`/agreements/${agreementId}`);
      revalidatePath("/agreements");
      return { ok: true };
    }

    const storagePath = generatedPackStoragePath({
      firmId: firm.id,
      agreementId,
      versionNumber: version.version_number,
    });

    const existingFile = await downloadPrivateFile(
      GENERATED_AGREEMENTS_BUCKET,
      storagePath,
    );
    if (existingFile) {
      return { error: "A generated pack for this version already exists and cannot be overwritten." };
    }

    const snapshot = version.snapshot as unknown as AgreementSnapshot;
    const attachmentPath = snapshot.attachment?.storagePath;
    if (!attachmentPath) {
      return { error: "No required attachment is recorded on the frozen snapshot." };
    }

    const attachmentBytes = await downloadPrivateFile(
      "required-attachments",
      attachmentPath,
    );
    if (!attachmentBytes) {
      return { error: "The required attachment could not be retrieved." };
    }

    const logoBytes = snapshot.firm.logoPath
      ? await downloadPrivateFile("firm-assets", snapshot.firm.logoPath)
      : null;

    const pack = await generateAgreementPackBytes({
      snapshot,
      attachmentBytes,
      logoBytes,
    });

    const { error: uploadError } = await supabase.storage
      .from(GENERATED_AGREEMENTS_BUCKET)
      .upload(storagePath, Buffer.from(pack.bytes), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    const { error: insertError } = await supabase.from("generated_agreement_packs").insert({
      firm_id: firm.id,
      costs_agreement_id: agreementId,
      agreement_version_id: version.id,
      version_number: version.version_number,
      generated_by: user.id,
      template_key: pack.templateKey,
      template_version: pack.templateVersion,
      required_attachment_id: pack.requiredAttachmentId,
      storage_path: storagePath,
      sha256: pack.sha256,
      page_count: pack.pageCount,
      byte_size: pack.bytes.byteLength,
      agreement_page_count: pack.agreementPageCount,
      attachment_page_count: pack.attachmentPageCount,
    });

    if (insertError) {
      return { error: insertError.message };
    }

    await markGenerated(firm.id, agreementId);

    await supabase.from("audit_events").insert({
      firm_id: firm.id,
      actor_user_id: user.id,
      entity_type: "costs_agreement",
      entity_id: agreementId,
      action: "generated",
      payload: {
        versionNumber: version.version_number,
        templateKey: pack.templateKey,
        templateVersion: pack.templateVersion,
        pageCount: pack.pageCount,
        sha256: pack.sha256,
      },
    });

    revalidatePath(`/agreements/${agreementId}`);
    revalidatePath("/agreements");
    return { ok: true };
  } catch (error) {
    if (error instanceof DocumentGenerationError) {
      return { error: error.message };
    }
    throw error;
  }
}
