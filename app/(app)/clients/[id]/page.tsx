import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Client",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("firm_id", firm.id)
    .eq("id", id)
    .maybeSingle();

  if (!client) {
    notFound();
  }

  const { data: matters } = await supabase
    .from("matters")
    .select("id, matter_number, matter_title, status")
    .eq("firm_id", firm.id)
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.display_name}
        description={`${client.client_type} · ${client.email ?? "No email recorded"}`}
      />
      <dl className="grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Phone
          </dt>
          <dd className="mt-2">{client.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Address
          </dt>
          <dd className="mt-2">
            {[
              client.address_line1,
              client.address_line2,
              client.suburb,
              client.state,
              client.postcode,
            ]
              .filter(Boolean)
              .join(", ") || "—"}
          </dd>
        </div>
      </dl>
      <section className="space-y-4">
        <h2 className="font-serif text-xl">Matters</h2>
        {!matters?.length ? (
          <EmptyState
            title="No matters"
            description="Matters for this client will be listed here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Title</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {matters.map((matter) => (
                <tr key={matter.id}>
                  <Td>
                    <Link href={`/matters/${matter.id}`} className="hover:underline">
                      {matter.matter_number}
                    </Link>
                  </Td>
                  <Td>{matter.matter_title}</Td>
                  <Td>
                    <Badge>{matter.status.replaceAll("_", " ")}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
