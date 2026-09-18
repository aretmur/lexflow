import type { Metadata } from "next";
import Link from "next/link";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { VICTORIAN_TEMPLATES } from "@/lib/agreements/constants";

export const metadata: Metadata = {
  title: "Agreements",
};

export default async function AgreementsPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: agreements, error } = await supabase
    .from("costs_agreements")
    .select("id, status, updated_at, matter_id, agreement_type")
    .eq("firm_id", firm.id)
    .order("updated_at", { ascending: false });

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agreements"
        description="Victorian short-form and staged costs agreements. Generate a pack from a frozen snapshot. Signing is not yet available."
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
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Matter</Th>
              <Th>Type</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((agreement) => {
              const matter = matterById.get(agreement.matter_id);
              const client = matter ? clientById.get(matter.client_id) : undefined;
              return (
                <tr key={agreement.id}>
                  <Td>
                    <Link href={`/agreements/${agreement.id}`} className="hover:underline">
                      {client?.display_name ?? "—"}
                    </Link>
                  </Td>
                  <Td>
                    {matter ? `${matter.matter_number} · ${matter.matter_title}` : "—"}
                  </Td>
                  <Td>{VICTORIAN_TEMPLATES[agreement.agreement_type].label}</Td>
                  <Td>
                    <Badge>{agreement.status.replaceAll("_", " ")}</Badge>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
