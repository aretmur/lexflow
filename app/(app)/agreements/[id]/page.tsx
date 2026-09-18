import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import { bundleToDraft, loadAgreementBundle } from "@/lib/agreements/bundle";
import { PageHeader } from "@/components/layout/page-header";
import { AgreementReview } from "@/components/agreements/agreement-review";

export const metadata: Metadata = {
  title: "Agreement",
};

export default async function AgreementReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const { firm } = await requireFirm();
  const bundle = await loadAgreementBundle(firm.id, id);
  if (!bundle) {
    notFound();
  }

  const draft = bundleToDraft(bundle);

  return (
    <div className="space-y-8">
      <PageHeader
        title={draft.matter.title || "Untitled matter"}
        description="Review the agreement. Sending for signature is not yet available."
      />
      <AgreementReview
        draft={draft}
        status={bundle.agreement.status}
        practitioner={bundle.practitioner}
      />
    </div>
  );
}
