import type { Metadata } from "next";
import Link from "next/link";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Agreements",
};

export default async function AgreementsPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: agreements, error } = await supabase
    .from("costs_agreements")
    .select("id, status, updated_at, matter_id")
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
        description="Costs agreements for the firm. Generation, sending and signing are not yet available."
        actions={
          <Link
            href="/agreements/new"
            className="inline-flex h-10 items-center border border-rule-strong bg-paper-raised px-4 text-sm font-medium"
          >
            New agreement
          </Link>
        }
      />
      {!agreements?.length ? (
        <EmptyState
          title="No costs agreements"
          description="Agreements will appear here after they are created from a matter."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Matter</Th>
              <Th>Status</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((agreement) => {
              const matter = matterById.get(agreement.matter_id);
              const client = matter ? clientById.get(matter.client_id) : undefined;
              return (
                <tr key={agreement.id}>
                  <Td>
                    {client ? (
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.display_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {matter ? (
                      <Link href={`/matters/${matter.id}`} className="hover:underline">
                        {matter.matter_number} · {matter.matter_title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Badge>{agreement.status.replaceAll("_", " ")}</Badge>
                  </Td>
                  <Td>{new Date(agreement.updated_at).toLocaleDateString("en-AU")}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
