import type { Metadata } from "next";
import Link from "next/link";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatAudFromCents } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Matters",
};

export default async function MattersPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: matters, error } = await supabase
    .from("matters")
    .select(
      "id, matter_number, matter_title, status, jurisdiction, agreed_or_estimated_cost_cents, client_id",
    )
    .eq("firm_id", firm.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const clientIds = [...new Set((matters ?? []).map((matter) => matter.client_id))];
  const { data: clients } = clientIds.length
    ? await supabase
        .from("clients")
        .select("id, display_name")
        .eq("firm_id", firm.id)
        .in("id", clientIds)
    : { data: [] };
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Matters"
        description="Each matter moves from instructions to a signed and funded costs agreement."
      />
      {!matters?.length ? (
        <EmptyState
          title="No matters yet"
          description="Matters will appear here once they are created for this firm."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Number</Th>
              <Th>Title</Th>
              <Th>Client</Th>
              <Th>Status</Th>
              <Th>Agreed / estimated</Th>
            </tr>
          </thead>
          <tbody>
            {matters.map((matter) => {
              const client = clientById.get(matter.client_id);
              return (
                <tr key={matter.id}>
                  <Td>
                    <Link href={`/matters/${matter.id}`} className="hover:underline">
                      {matter.matter_number}
                    </Link>
                  </Td>
                  <Td>{matter.matter_title}</Td>
                  <Td>
                    <Link
                      href={`/clients/${matter.client_id}`}
                      className="hover:underline"
                    >
                      {client?.display_name ?? "—"}
                    </Link>
                  </Td>
                  <Td>
                    <Badge>{matter.status.replaceAll("_", " ")}</Badge>
                  </Td>
                  <Td className="tabular-nums">
                    {formatAudFromCents(matter.agreed_or_estimated_cost_cents)}
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
