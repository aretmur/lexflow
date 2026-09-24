import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseSignatureStore } from "@/lib/signatures/store";
import type {
  SignatureRequestRecord,
  SignedAgreementDocumentRecord,
  SignedDocumentDeliveryRecord,
} from "@/lib/signatures/types";

export async function loadLatestSignatureRequest(
  firmId: string,
  agreementId: string,
): Promise<SignatureRequestRecord | null> {
  const supabase = await createServerSupabaseClient();
  return createSupabaseSignatureStore(supabase).loadLatestRequest(firmId, agreementId);
}

export async function loadSignedAgreementDocument(
  firmId: string,
  agreementId: string,
): Promise<SignedAgreementDocumentRecord | null> {
  const supabase = await createServerSupabaseClient();
  return createSupabaseSignatureStore(supabase).loadSignedDocument(firmId, agreementId);
}

export async function loadSignedDocumentDeliveries(
  firmId: string,
  signedDocumentId: string,
): Promise<SignedDocumentDeliveryRecord[]> {
  const supabase = await createServerSupabaseClient();
  return createSupabaseSignatureStore(supabase).listDeliveries(firmId, signedDocumentId);
}
