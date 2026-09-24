import type { Metadata } from "next";
import Link from "next/link";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AgreementsList } from "@/components/agreements/agreements-list";
import { groupAgreementsByMonth } from "@/lib/agreements/list";
import { VICTORIAN_TEMPLATES } from "@/lib/agreements/constants";

export const metadata: Metadata = {
  title: "Agreements",
};

export default async function AgreementsPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: agreements, error } = await supabase
    .from("costs_agreements")
    .select("id, status, created_at, updated_at, matter_id, agreement_type")
    .eq("firm_id", firm.id)
    .is("discarded_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const matterIds = [...new Set((agreements ?? []).map((agreement) => agreement.matter_id))];
  const { data: matters } = matterIds.length
    ? await supabase
        .from("matters")
        .select("id, matter_number, matter_title, client_id")
        .eq("firm_id", firm.id)
        .in("id", matterIds)
    : { data: [] };

  const clientIds = [...new Set((matters ?? []).map((matter) => matter.client_id))];
  const { data: clients } = clientIds.length
    ? await supabase
        .from("clients")
        .select("id, display_name")
        .eq("firm_id", firm.id)
        .in("id", clientIds)
    : { data: [] };

  const matterById = new Map((matters ?? []).map((matter) => [matter.id, matter]));
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));
  const groups = groupAgreementsByMonth(
    (agreements ?? []).map((agreement) => {
      const matter = matterById.get(agreement.matter_id);
      const client = matter ? clientById.get(matter.client_id) : undefined;
      return {
        id: agreement.id,
        clientName: client?.display_name ?? "—",
        matterLabel: matter ? `${matter.matter_number} · ${matter.matter_title}` : "—",
        typeLabel: VICTORIAN_TEMPLATES[agreement.agreement_type].label,
        status: agreement.status,
        createdAt: agreement.created_at,
      };
    }),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agreements"
        description="Victorian short-form and staged costs agreements, grouped by the month they were created. Incorrect drafts can be deleted; signed agreements are kept."
        actions={
          <Link
            href="/agreements/new"
            className="inline-flex h-10 items-center bg-accent px-4 text-sm font-medium text-paper-raised hover:bg-accent-hover"
          >
            New Agreement
          </Link>
        }
      />
      {!agreements?.length ? (
        <EmptyState
          title="No agreements yet"
          description="Create a short-form or full/staged agreement. Client and matter details are collected in that flow."
        />
      ) : (
        <AgreementsList groups={groups} />
      )}
    </div>
  );
}
