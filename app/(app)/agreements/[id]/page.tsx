import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import { bundleToDraft, loadAgreementBundle } from "@/lib/agreements/bundle";
import {
  loadLatestGeneratedPack,
  loadLatestIssuedVersion,
} from "@/lib/agreements/packs";
import { PageHeader } from "@/components/layout/page-header";
import { AgreementReview } from "@/components/agreements/agreement-review";
import type { AgreementSnapshot } from "@/lib/agreements/snapshot";

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
  const pack = await loadLatestGeneratedPack(firm.id, id);
  const version = await loadLatestIssuedVersion(firm.id, id);
  const snapshot = version?.snapshot as AgreementSnapshot | undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title={draft.matter.title || "Untitled matter"}
        description={
          bundle.agreement.status === "generated"
            ? "Generated pack is frozen. Sending for signature is not yet available."
            : bundle.agreement.status === "ready"
              ? "Snapshot is frozen. Generate the agreement pack, or edit to create a new version."
              : "Review the agreement. Sending for signature is not yet available."
        }
      />
      <AgreementReview
        draft={draft}
        status={bundle.agreement.status}
        practitioner={bundle.practitioner}
        pack={
          pack
            ? {
                versionNumber: pack.version_number,
                generatedAt: pack.generated_at,
                templateVersion: pack.template_version,
                attachmentVersion: snapshot?.attachment?.version ?? null,
                pageCount: pack.page_count,
              }
            : null
        }
      />
    </div>
  );
}
