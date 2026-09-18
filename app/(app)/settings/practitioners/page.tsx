import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Practitioners",
};

export default async function PractitionersPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: practitioners, error } = await supabase
    .from("practitioners")
    .select("id, full_name, title, email, practising_certificate_number")
    .eq("firm_id", firm.id)
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Practitioners"
        description="Solicitors and principals responsible for matters."
      />
      {!practitioners?.length ? (
        <EmptyState
          title="No practitioners yet"
          description="Practitioners will appear here once they are added for this firm."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Title</Th>
              <Th>Email</Th>
              <Th>Practising certificate</Th>
            </tr>
          </thead>
          <tbody>
            {practitioners.map((practitioner) => (
              <tr key={practitioner.id}>
                <Td>{practitioner.full_name}</Td>
                <Td>{practitioner.title ?? "—"}</Td>
                <Td>{practitioner.email ?? "—"}</Td>
                <Td>{practitioner.practising_certificate_number ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
