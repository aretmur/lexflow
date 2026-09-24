"use server";

import { headers } from "next/headers";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import {
  completeNativeSigning,
  sendNativeSigningOtp,
  verifyNativeSigningOtp,
} from "@/lib/signatures/native-workflow";
import type { SignatureMark } from "@/lib/signatures/stamp";
import { SignatureWorkflowError } from "@/lib/signatures/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isNextNavigationError, publicActionError } from "@/lib/server-log";
import type { FormActionState, NativeSigningActionState } from "@/lib/validations";

function actionError(error: unknown, fallback: string): FormActionState {
  if (isNextNavigationError(error)) {
    throw error;
  }
  if (error instanceof SignatureWorkflowError) {
    return { error: error.message };
  }
  return {
    error: publicActionError(error instanceof Error ? error.message : undefined, fallback),
  };
}

function store() {
  return createSupabaseSignatureStore(createAdminSupabaseClient());
}

function parseMark(kind: string, png: string, text: string, label: string): SignatureMark {
  if (kind === "draw") {
    if (!png.trim()) {
      throw new SignatureWorkflowError(`Draw your ${label} before continuing.`);
    }
    return { kind: "draw", pngBase64: png };
  }
  if (!text.trim()) {
    throw new SignatureWorkflowError(`Type your ${label} before continuing.`);
  }
  return { kind: "type", text };
}

export async function sendSigningOtpAction(token: string): Promise<FormActionState> {
  try {
    await sendNativeSigningOtp({ store: store(), token });
    return { ok: true };
  } catch (error) {
    return actionError(error, "Unable to send a verification code.");
  }
}

export async function verifySigningOtpAction(
  token: string,
  code: string,
): Promise<FormActionState> {
  try {
    await verifyNativeSigningOtp({ store: store(), token, code });
    return { ok: true };
  } catch (error) {
    return actionError(error, "Unable to verify that code.");
  }
}

export async function completeNativeSigningAction(
  formData: FormData,
): Promise<NativeSigningActionState> {
  try {
    const token = String(formData.get("token") ?? "");
    const headerStore = await headers();
    const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
    let initialledPages: number[] = [];
    try {
      const parsed = JSON.parse(String(formData.get("initialledPages") ?? "[]"));
      if (!Array.isArray(parsed) || parsed.some((page) => !Number.isInteger(page))) {
        throw new Error("invalid");
      }
      initialledPages = parsed;
    } catch {
      throw new SignatureWorkflowError("Initialled pages could not be read.");
    }
    const completed = await completeNativeSigning({
      store: store(),
      token,
      consentAccepted: formData.get("consentAccepted") === "true",
      signerName: String(formData.get("signerName") ?? ""),
      signedDate: String(formData.get("signedDate") ?? ""),
      signerCapacity: String(formData.get("signerCapacity") ?? ""),
      signature: parseMark(
        String(formData.get("signatureKind") ?? ""),
        String(formData.get("signaturePng") ?? ""),
        String(formData.get("signatureText") ?? ""),
        "signature",
      ),
      initials:
        formData.get("requirePageInitials") === "true"
          ? parseMark(
              String(formData.get("initialsKind") ?? ""),
              String(formData.get("initialsPng") ?? ""),
              String(formData.get("initialsText") ?? ""),
              "initials",
            )
          : { kind: "type", text: "-" },
      initialledPages,
      signerIp: forwarded || headerStore.get("x-real-ip"),
      signerUserAgent: headerStore.get("user-agent"),
    });
    return {
      ok: true,
      clientCopySent: completed.clientCopySent,
      clientCopyMaskedEmail: completed.clientCopyMaskedEmail,
    };
  } catch (error) {
    return actionError(error, "Unable to complete signing.");
  }
}
