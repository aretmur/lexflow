"use server";

import { revalidatePath } from "next/cache";
import { requireFirm } from "@/lib/auth/session";
import { isDropboxSignTestMode } from "@/lib/signatures/config";
import { getSignatureProvider } from "@/lib/signatures/provider";
import { signingQrDataUrl } from "@/lib/signatures/qr";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import {
  cancelSignatureRequest,
  refreshEmbeddedSigningSession,
  resendSignatureRequest,
  retrySignedDocumentIngest,
  sendForSignature,
  startEmbeddedSigning,
} from "@/lib/signatures/workflow";
import {
  SignatureProviderError,
  SignatureWorkflowError,
  type SigningMode,
} from "@/lib/signatures/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isNextNavigationError, publicActionError } from "@/lib/server-log";
import type { FormActionState, SigningActionState } from "@/lib/validations";

function actionError(error: unknown, fallback: string): SigningActionState {
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

function readSigner(formData: FormData) {
  return {
    name: String(formData.get("signerName") ?? ""),
    email: String(formData.get("signerEmail") ?? ""),
  };
}

function readRequirePageInitials(formData: FormData, firmDefault: boolean) {
  if (formData.get("requirePageInitials") == null) {
    return firmDefault;
  }
  return (
    formData.get("requirePageInitials") === "true" ||
    formData.get("requirePageInitials") === "on"
  );
}

export async function startSigningAction(
  formData: FormData,
): Promise<SigningActionState> {
  try {
    const { firm, user } = await requireFirm();
    const agreementId = String(formData.get("agreementId") ?? "");
    const signingMode = String(formData.get("signingMode") ?? "") as SigningMode;
    const supabase = await createServerSupabaseClient();
    const store = createSupabaseSignatureStore(supabase);
    const provider = getSignatureProvider();
    const shared = {
      store,
      provider,
      firmId: firm.id,
      agreementId,
      actorUserId: user.id,
      signer: readSigner(formData),
      testMode: isDropboxSignTestMode(),
      requirePageInitials: readRequirePageInitials(
        formData,
        firm.require_page_initials !== false,
      ),
      replaceActive: true,
    };

    if (signingMode === "email") {
      await sendForSignature(shared);
      refreshAgreement(agreementId);
      return { ok: true };
    }

    if (signingMode !== "embedded_qr" && signingMode !== "embedded_same_device") {
      return { error: "Choose how the client should sign." };
    }

    const result = await startEmbeddedSigning({
      ...shared,
      signingMode,
    });
    refreshAgreement(agreementId);
    return {
      ok: true,
      signingUrl: result.signingUrl,
      qrDataUrl: await signingQrDataUrl(result.signingUrl),
    };
  } catch (error) {
    return actionError(error, "Unable to start the signing session.");
  }
}

export async function sendForSignatureAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  formData.set("signingMode", "email");
  return startSigningAction(formData);
}

export async function refreshSigningSessionAction(
  agreementId: string,
): Promise<SigningActionState> {
  try {
    const { firm, user } = await requireFirm();
    const supabase = await createServerSupabaseClient();
    const result = await refreshEmbeddedSigningSession({
      store: createSupabaseSignatureStore(supabase),
      firmId: firm.id,
      agreementId,
      actorUserId: user.id,
    });
    refreshAgreement(agreementId);
    return {
      ok: true,
      signingUrl: result.signingUrl,
      qrDataUrl: await signingQrDataUrl(result.signingUrl),
    };
  } catch (error) {
    return actionError(error, "Unable to reopen the signing session.");
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
