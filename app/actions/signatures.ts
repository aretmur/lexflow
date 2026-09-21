"use server";

import { revalidatePath } from "next/cache";
import { requireFirm } from "@/lib/auth/session";
import { isDropboxSignTestMode } from "@/lib/signatures/config";
import { getSignatureProvider } from "@/lib/signatures/provider";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import {
  cancelSignatureRequest,
  resendSignatureRequest,
  retrySignedDocumentIngest,
  sendForSignature,
} from "@/lib/signatures/workflow";
import {
  SignatureProviderError,
  SignatureWorkflowError,
} from "@/lib/signatures/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isNextNavigationError, publicActionError } from "@/lib/server-log";
import type { FormActionState } from "@/lib/validations";

function actionError(error: unknown, fallback: string): FormActionState {
  if (isNextNavigationError(error)) {
    throw error;
  }
  if (error instanceof SignatureWorkflowError || error instanceof SignatureProviderError) {
    return { error: error.message };
  }
  return {
    error: publicActionError(error instanceof Error ? error.message : undefined, fallback),
  };
}

function refreshAgreement(agreementId: string) {
  revalidatePath(`/agreements/${agreementId}`);
  revalidatePath("/agreements");
}

export async function sendForSignatureAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    const { firm, user } = await requireFirm();
    const agreementId = String(formData.get("agreementId") ?? "");
    const supabase = await createServerSupabaseClient();
    await sendForSignature({
      store: createSupabaseSignatureStore(supabase),
      provider: getSignatureProvider(),
      firmId: firm.id,
      agreementId,
      actorUserId: user.id,
      signer: {
        name: String(formData.get("signerName") ?? ""),
        email: String(formData.get("signerEmail") ?? ""),
      },
      testMode: isDropboxSignTestMode(),
    });
    refreshAgreement(agreementId);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Unable to send the agreement for signature.");
  }
}

export async function resendSignatureRequestAction(
  agreementId: string,
): Promise<FormActionState> {
  try {
    const { firm, user } = await requireFirm();
    const supabase = await createServerSupabaseClient();
    await resendSignatureRequest({
      store: createSupabaseSignatureStore(supabase),
      provider: getSignatureProvider(),
      firmId: firm.id,
      agreementId,
      actorUserId: user.id,
    });
    refreshAgreement(agreementId);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Unable to resend the signing request.");
  }
}

export async function cancelSignatureRequestAction(
  agreementId: string,
): Promise<FormActionState> {
  try {
    const { firm, user } = await requireFirm();
    const supabase = await createServerSupabaseClient();
    await cancelSignatureRequest({
      store: createSupabaseSignatureStore(supabase),
      provider: getSignatureProvider(),
      firmId: firm.id,
      agreementId,
      actorUserId: user.id,
    });
    refreshAgreement(agreementId);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Unable to cancel the signing request.");
  }
}

export async function retrySignedDocumentAction(
  agreementId: string,
): Promise<FormActionState> {
  try {
    const { firm } = await requireFirm();
    const supabase = await createServerSupabaseClient();
    await retrySignedDocumentIngest({
      store: createSupabaseSignatureStore(supabase),
      provider: getSignatureProvider(),
      firmId: firm.id,
      agreementId,
    });
    refreshAgreement(agreementId);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Unable to retrieve the signed agreement.");
  }
}
