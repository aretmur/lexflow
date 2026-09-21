import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameFirm } from "@/lib/tenancy";
import type {
  AgreementVersion,
  GeneratedAgreementPack,
} from "@/lib/types/database";

export async function loadLatestIssuedVersion(
  firmId: string,
  agreementId: string,
): Promise<AgreementVersion | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("agreement_versions")
    .select("*")
    .eq("firm_id", firmId)
    .eq("costs_agreement_id", agreementId)
    .in("status", ["issued", "signed"])
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }
  assertSameFirm(firmId, data.firm_id);
  return data;
}

export async function loadPackForVersion(
  firmId: string,
  agreementVersionId: string,
): Promise<GeneratedAgreementPack | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("generated_agreement_packs")
    .select("*")
    .eq("firm_id", firmId)
    .eq("agreement_version_id", agreementVersionId)
    .maybeSingle();

  if (!data) {
    return null;
  }
  assertSameFirm(firmId, data.firm_id);
  return data;
}

export async function loadLatestGeneratedPack(
  firmId: string,
  agreementId: string,
): Promise<GeneratedAgreementPack | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("generated_agreement_packs")
    .select("*")
    .eq("firm_id", firmId)
    .eq("costs_agreement_id", agreementId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }
  assertSameFirm(firmId, data.firm_id);
  return data;
}

export async function downloadPrivateFile(
  bucket: string,
  path: string,
): Promise<Uint8Array | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return null;
  }
  return new Uint8Array(await data.arrayBuffer());
}
