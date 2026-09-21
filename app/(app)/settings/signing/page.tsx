import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Notice } from "@/components/ui/notice";
import { SigningForm } from "@/app/(app)/settings/signing/signing-form";

export const metadata: Metadata = {
  title: "Signing",
};

export default async function SigningSettingsPage() {
  const { firm, membership } = await requireFirm();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Signing"
        description="Defaults for electronic signature requests sent from this firm."
      />
      <Notice>
        Your role: {membership.role}. Only owners and administrators can change
        signing settings. Victorian costs agreement templates default to requiring
        client initials on every page of the final pack, including the appended
        information sheet.
      </Notice>
      <SigningForm requirePageInitials={firm.require_page_initials !== false} />
    </div>
  );
}
