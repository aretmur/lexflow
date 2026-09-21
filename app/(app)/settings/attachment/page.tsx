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

  const active = attachments?.find((attachment) => attachment.is_active);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Required attachment"
        description="Upload the required costs information sheet. The active version is automatically appended to every new agreement when the agreement is marked ready."
      />
      <Notice>
        Current Victorian attachment: {REQUIRED_ATTACHMENT_TITLE}. Uploading a new
        file makes that version active and previous versions inactive. Frozen and
        generated agreements keep the version they were created with.
      </Notice>
      {active ? (
        <div className="border border-rule bg-paper-raised px-4 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Active version
          </p>
          <p className="mt-1 font-serif text-2xl">Version {active.version}</p>
          <p className="mt-1 text-sm text-ink-muted">{active.original_filename}</p>
        </div>
      ) : null}
      <AttachmentUploadForm />
      {!attachments?.length ? (
        <EmptyState
          title="No attachment uploaded"
          description="Upload the July 2022 information sheet PDF. It will be appended automatically when an agreement is marked ready."
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
