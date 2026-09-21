import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import {
  bundleToDraft,
  loadActiveRequiredAttachment,
  loadAgreementBundle,
} from "@/lib/agreements/bundle";
import { snapshotHasRequiredAttachment } from "@/lib/agreements/required-attachment";
import {
  loadLatestGeneratedPack,
  loadLatestIssuedVersion,
} from "@/lib/agreements/packs";
import {
  loadLatestSignatureRequest,
  loadSignedAgreementDocument,
} from "@/lib/signatures/load";
import { isDropboxSignTestMode } from "@/lib/signatures/config";
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
  const signatureRequest = await loadLatestSignatureRequest(firm.id, id);
  const signedDocument = await loadSignedAgreementDocument(firm.id, id);
  const activeAttachment = await loadActiveRequiredAttachment(firm.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title={draft.matter.title || "Untitled matter"}
        description={headerDescription(bundle.agreement.status)}
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
        testMode={isDropboxSignTestMode()}
        signatureRequest={
          signatureRequest
            ? {
                signerName: signatureRequest.signerName,
                signerEmail: signatureRequest.signerEmail,
                status: signatureRequest.status,
                sentAt: signatureRequest.sentAt,
                viewedAt: signatureRequest.viewedAt,
                signedAt: signatureRequest.signedAt,
                lastError: signatureRequest.lastError,
                testMode: signatureRequest.testMode,
              }
            : null
        }
        signedDocument={
          signedDocument
            ? {
                signedAt: signedDocument.signedAt,
                sha256: signedDocument.sha256,
              }
            : null
        }
        hasActiveAttachment={Boolean(activeAttachment)}
        frozenAttachmentMissing={
          bundle.agreement.status === "ready" && !snapshotHasRequiredAttachment(snapshot)
        }
        defaultRequirePageInitials={firm.require_page_initials !== false}
      />
    </div>
  );
}

function headerDescription(status: string) {
  if (status === "generated") {
    return "Generated pack is frozen. Confirm the client details and send for signature.";
  }
  if (status === "sent" || status === "viewed") {
    return "Awaiting the client to sign from the secure signing link.";
  }
  if (status === "signed") {
    return "This costs agreement has been signed. The original generated pack remains available.";
  }
  if (status === "ready") {
    return "Snapshot is frozen. Generate the agreement pack, or edit to create a new version.";
  }
  return "Review the agreement before generating and sending for signature.";
}
