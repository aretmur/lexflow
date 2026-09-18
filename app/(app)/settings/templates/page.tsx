import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { LegalReviewNotice } from "@/components/legal-review-notice";

export const metadata: Metadata = {
  title: "Templates",
};

export default async function TemplatesPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: templates, error } = await supabase
    .from("legal_templates")
    .select(
      "id, template_name, jurisdiction, version, status, effective_date, last_reviewed_date",
    )
    .eq("firm_id", firm.id)
    .order("template_name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Templates"
        description="Deterministic costs-agreement templates. Only approved templates will later be available for production generation."
      />
      <LegalReviewNotice />
      {!templates?.length ? (
        <EmptyState
          title="No templates"
          description="When templates are added they will start as under legal review. Lexflow does not invent approved Victorian legal content."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Jurisdiction</Th>
              <Th>Version</Th>
              <Th>Status</Th>
              <Th>Effective</Th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <Td>{template.template_name}</Td>
                <Td>{template.jurisdiction}</Td>
                <Td>{template.version}</Td>
                <Td>
                  <Badge
                    tone={
                      template.status === "approved" ? "accent" : "warning"
                    }
                  >
                    {template.status === "under_legal_review"
                      ? "UNDER LEGAL REVIEW"
                      : template.status.replaceAll("_", " ")}
                  </Badge>
                </Td>
                <Td>{template.effective_date ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
