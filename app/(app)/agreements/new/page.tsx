import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
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
        description="Choose the Victorian template."
      />
      <NewAgreementChooser />
    </div>
  );
}
