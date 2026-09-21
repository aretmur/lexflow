import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { LegalReviewNotice } from "@/components/legal-review-notice";
import { NewAgreementChooser } from "@/components/agreements/new-agreement-chooser";

export const metadata: Metadata = {
  title: "New agreement",
};

export default async function NewAgreementPage() {
  await requireFirm();

  return (
    <div className="space-y-8">
      <PageHeader
        title="New agreement"
        description="Choose the Victorian template. Both options remain under legal review."
      />
      <LegalReviewNotice />
      <NewAgreementChooser />
    </div>
  );
}
