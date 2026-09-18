import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Notice } from "@/components/ui/notice";
import { FirmForm } from "@/app/(app)/settings/firm/firm-form";

export const metadata: Metadata = {
  title: "Firm",
};

export default async function FirmSettingsPage() {
  const context = await requireUser();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Firm"
        description="The practice this workspace belongs to. Every record in Lexflow is scoped to a firm."
      />
      {!context.firm ? (
        <Notice>
          Create the firm to continue. You will be the owner of this practice
          workspace.
        </Notice>
      ) : (
        <Notice>
          Your role: {context.membership?.role ?? "member"}. Only owners and
          administrators can change firm details.
        </Notice>
      )}
      <FirmForm firm={context.firm} />
    </div>
  );
}
