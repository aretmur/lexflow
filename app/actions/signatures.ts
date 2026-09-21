"use server";

import { revalidatePath } from "next/cache";
import { requireFirm } from "@/lib/auth/session";
import {
  firmSigningProvider,
  isDropboxSignTestMode,
  isSigningTestMode,
} from "@/lib/signatures/config";
import { getSignatureProvider } from "@/lib/signatures/provider";
import { signingQrDataUrl } from "@/lib/signatures/qr";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import { firmSigningEmailIdentity } from "@/lib/email/identity";
import { resendNativeSigningLink, reopenNativeSigningSession, startNativeSigning } from "@/lib/signatures/native-workflow";
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

function mapSigningMode(
  provider: "native_lexflow" | "dropbox_sign",
  mode: string,
): SigningMode | null {
  if (mode === "email") {
    return "email";
  }
  if (provider === "native_lexflow") {
    if (mode === "qr" || mode === "embedded_qr") {
      return "qr";
    }
    if (mode === "same_device" || mode === "embedded_same_device") {
      return "same_device";
    }
    return null;
  }
  if (mode === "qr" || mode === "embedded_qr") {
    return "embedded_qr";
  }
  if (mode === "same_device" || mode === "embedded_same_device") {
    return "embedded_same_device";
  }
  return null;
}

export async function startSigningAction(
  formData: FormData,
): Promise<SigningActionState> {
  try {
    const { firm, user } = await requireFirm();
    const agreementId = String(formData.get("agreementId") ?? "");
    const providerName = firmSigningProvider(firm.signing_provider);
    const signingMode = mapSigningMode(providerName, String(formData.get("signingMode") ?? ""));
    const supabase = await createServerSupabaseClient();
    const store = createSupabaseSignatureStore(supabase);
    const provider = getSignatureProvider(providerName);
    const shared = {
      store,
      provider,
      firmId: firm.id,
      agreementId,
      actorUserId: user.id,
      signer: readSigner(formData),
      testMode:
        providerName === "native_lexflow" ? isSigningTestMode() : isDropboxSignTestMode(),
      requirePageInitials: readRequirePageInitials(
        formData,
        firm.require_page_initials !== false,
      ),
      replaceActive: true,
    };

    if (!signingMode) {
      return { error: "Choose how the client should sign." };
    }

    if (providerName === "native_lexflow") {
      const identity = firmSigningEmailIdentity(firm);
      try {
        const result = await startNativeSigning({
          ...shared,
          provider: { name: "native_lexflow", cancelSignatureRequest: provider.cancelSignatureRequest },
          firmName: identity.displayName,
          signingMode: signingMode as "qr" | "email" | "same_device",
          requireEmailOtpForQr: firm.require_email_otp_for_qr,
          emailFrom: identity.senderEmail,
          emailReplyTo: identity.replyTo,
        });
        refreshAgreement(agreementId);
        return {
          ok: true,
          signingUrl: result.signingUrl,
          qrDataUrl: await signingQrDataUrl(result.signingUrl),
        };
      } catch (error) {
        refreshAgreement(agreementId);
        return actionError(error, "Unable to start the signing session.");
      }
    }

    if (signingMode === "email") {
      await sendForSignature(shared);
      refreshAgreement(agreementId);
      return { ok: true };
    }

    const result = await startEmbeddedSigning({
      ...shared,
      signingMode: signingMode as "embedded_qr" | "embedded_same_device",
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
    const store = createSupabaseSignatureStore(supabase);
    const providerName = firmSigningProvider(firm.signing_provider);
    const result =
      providerName === "native_lexflow"
        ? await reopenNativeSigningSession({
            store,
            firmId: firm.id,
            agreementId,
            actorUserId: user.id,
          })
        : await refreshEmbeddedSigningSession({
            store,
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
    const store = createSupabaseSignatureStore(supabase);
    const providerName = firmSigningProvider(firm.signing_provider);
    if (providerName === "native_lexflow") {
      const identity = firmSigningEmailIdentity(firm);
      await resendNativeSigningLink({
        store,
        firmId: firm.id,
        agreementId,
        actorUserId: user.id,
        firmName: identity.displayName,
        emailFrom: identity.senderEmail,
        emailReplyTo: identity.replyTo,
      });
    } else {
      await resendSignatureRequest({
        store,
        provider: getSignatureProvider(providerName),
        firmId: firm.id,
        agreementId,
        actorUserId: user.id,
      });
    }
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
      provider: getSignatureProvider(firmSigningProvider(firm.signing_provider)),
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
      provider: getSignatureProvider(firmSigningProvider(firm.signing_provider)),
      firmId: firm.id,
      agreementId,
    });
    refreshAgreement(agreementId);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Unable to retrieve the signed agreement.");
  }
}
