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
  loadSignedDocumentDeliveries,
} from "@/lib/signatures/load";
import {
  firmSigningProvider,
  isDropboxSignTestMode,
  isSigningTestMode,
} from "@/lib/signatures/config";
import { generateAgreementAction } from "@/app/actions/generate-agreement";
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
  const version = await loadLatestIssuedVersion(firm.id, id);
  const snapshot = version?.snapshot as AgreementSnapshot | undefined;
  if (
    bundle.agreement.status === "ready" &&
    snapshotHasRequiredAttachment(snapshot)
  ) {
    await generateAgreementAction(id);
  }
  const pack = await loadLatestGeneratedPack(firm.id, id);
  const latestBundle = await loadAgreementBundle(firm.id, id);
  if (!latestBundle) {
    notFound();
  }
  const signatureRequest = await loadLatestSignatureRequest(firm.id, id);
  const signedDocument = await loadSignedAgreementDocument(firm.id, id);
  const deliveries = signedDocument
    ? await loadSignedDocumentDeliveries(firm.id, signedDocument.id)
    : [];
  const activeAttachment = await loadActiveRequiredAttachment(firm.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title={draft.matter.title || "Untitled matter"}
        description={headerDescription(latestBundle.agreement.status)}
      />
      <AgreementReview
        draft={draft}
        status={latestBundle.agreement.status}
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
        testMode={
          firmSigningProvider(firm.signing_provider) === "native_lexflow"
            ? isSigningTestMode()
            : isDropboxSignTestMode()
        }
        signatureRequest={
          signatureRequest
            ? {
                signerName: signatureRequest.signerName,
                signerEmail: signatureRequest.signerEmail,
                status: signatureRequest.status,
                signingMode: signatureRequest.signingMode ?? "email",
                sentAt: signatureRequest.sentAt,
                emailSentAt: signatureRequest.emailSentAt,
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
        deliveries={deliveries.map((row) => ({
          recipientRole: row.recipientRole,
          recipientEmail: row.recipientEmail,
          status: row.status,
          lastError: row.lastError,
          sentAt: row.sentAt,
          attemptCount: row.attemptCount,
        }))}
        hasActiveAttachment={Boolean(activeAttachment)}
        frozenAttachmentMissing={
          latestBundle.agreement.status === "ready" && !snapshotHasRequiredAttachment(snapshot)
        }
        defaultRequirePageInitials={firm.require_page_initials !== false}
      />
    </div>
  );
}

function headerDescription(status: string) {
  if (status === "generated") {
    return "Check the pack, then send a signing link or sign on this device.";
  }
  if (status === "sent" || status === "viewed") {
    return "Signing in progress. The lawyer screen updates when the client signs.";
  }
  if (status === "signed") {
    return "This costs agreement has been signed. The original generated pack remains available.";
  }
  if (status === "ready") {
    return "The agreement pack is being prepared. Refresh if it does not appear.";
  }
  return "Review the figures, then send the agreement for signature.";
}
