import type { Metadata } from "next";
import Link from "next/link";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Clients",
};

export default async function ClientsPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, display_name, client_type, email, created_at")
    .eq("firm_id", firm.id)
    .order("display_name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clients"
        description="People and entities who have instructed the firm."
      />
      {!clients?.length ? (
        <EmptyState
          title="No clients yet"
          description="Clients will appear here once they are created for this firm."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Email</Th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <Td>
                  <Link href={`/clients/${client.id}`} className="hover:underline">
                    {client.display_name}
                  </Link>
                </Td>
                <Td className="capitalize">{client.client_type}</Td>
                <Td>{client.email ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
