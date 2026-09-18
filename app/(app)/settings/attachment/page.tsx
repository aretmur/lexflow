import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AttachmentUploadForm } from "@/app/(app)/settings/attachment/upload-form";
import { REQUIRED_ATTACHMENT_TITLE } from "@/lib/agreements/constants";

export const metadata: Metadata = {
  title: "Required attachment",
};

export default async function AttachmentSettingsPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: attachments, error } = await supabase
    .from("required_attachments")
    .select(
      "id, title, version, original_filename, is_active, uploaded_at, used_at, byte_size",
    )
    .eq("firm_id", firm.id)
    .order("version", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Required attachment"
        description="Upload the Legal Services Council costs-agreement information sheet. It will later be combined with the generated agreement. PDF merge is not implemented yet."
      />
      <Notice>
        Current Victorian attachment: {REQUIRED_ATTACHMENT_TITLE}. A version used in a
        ready agreement cannot be altered.
      </Notice>
      <AttachmentUploadForm />
      {!attachments?.length ? (
        <EmptyState
          title="No attachment uploaded"
          description="Upload the July 2022 information sheet PDF to attach it to future agreements."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Version</Th>
              <Th>File</Th>
              <Th>Uploaded</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {attachments.map((attachment) => (
              <tr key={attachment.id}>
                <Td>{attachment.version}</Td>
                <Td>{attachment.original_filename}</Td>
                <Td>{new Date(attachment.uploaded_at).toLocaleDateString("en-AU")}</Td>
                <Td>
                  <Badge tone={attachment.is_active ? "accent" : "neutral"}>
                    {attachment.is_active ? "Active" : "Inactive"}
                    {attachment.used_at ? " · used" : ""}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
