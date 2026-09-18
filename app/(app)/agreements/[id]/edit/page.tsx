import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { bundleToDraft, loadAgreementBundle } from "@/lib/agreements/bundle";
import { PageHeader } from "@/components/layout/page-header";
import { AgreementForm } from "@/components/agreements/agreement-form";
import { VICTORIAN_TEMPLATES } from "@/lib/agreements/constants";

export const metadata: Metadata = {
  title: "Edit agreement",
};

export default async function EditAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const { firm } = await requireFirm();
  const bundle = await loadAgreementBundle(firm.id, id);
  if (!bundle) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: practitioners } = await supabase
    .from("practitioners")
    .select("id, full_name, title, default_hourly_rate_cents, is_active")
    .eq("firm_id", firm.id)
    .order("full_name");

  const draft = bundleToDraft(bundle);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Edit agreement"
        description={`${VICTORIAN_TEMPLATES[draft.agreementType].label} · Victoria`}
      />
      <AgreementForm initialDraft={draft} practitioners={practitioners ?? []} />
    </div>
  );
}
