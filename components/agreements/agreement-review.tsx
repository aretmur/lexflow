"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  markAgreementReadyAction,
  reopenAgreementDraftAction,
  saveAgreementDraftAction,
} from "@/app/actions/agreements";
import { generateAgreementAction } from "@/app/actions/generate-agreement";
import {
  SignaturePanel,
  type SignaturePanelDocument,
  type SignaturePanelRequest,
} from "@/components/agreements/signature-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { VICTORIAN_TEMPLATES } from "@/lib/agreements/constants";
import {
  calculateShortFormPricing,
  calculateStagedPricing,
} from "@/lib/agreements/pricing";
import { formatAudFromCents } from "@/lib/money";
import {
  shortFormBasisLabel,
  shortFormFeeLabel,
  shortFormReviewShowsHourlyRate,
} from "@/lib/agreements/short-form-pricing";
import { formatDocumentDate } from "@/lib/documents/formatters";
import type { AgreementDraft } from "@/lib/validations";
import type { Practitioner } from "@/lib/types/database";

export type PackSummary = {
  versionNumber: number;
  generatedAt: string;
  templateVersion: string;
  attachmentVersion: number | null;
  pageCount: number;
};

export function AgreementReview({
  draft,
  status,
  practitioner,
  pack,
  testMode,
  signatureRequest,
  signedDocument,
  hasActiveAttachment,
  frozenAttachmentMissing,
}: {
  draft: AgreementDraft;
  status: string;
  practitioner: Pick<Practitioner, "full_name" | "title"> | null;
  pack: PackSummary | null;
  testMode: boolean;
  signatureRequest: SignaturePanelRequest | null;
  signedDocument: SignaturePanelDocument | null;
  hasActiveAttachment: boolean;
  frozenAttachmentMissing: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const template = VICTORIAN_TEMPLATES[draft.agreementType];
  const shortForm = calculateShortFormPricing(draft.pricing);
  const staged = calculateStagedPricing({
    stages: draft.stages,
    disbursementsCents: draft.pricing.disbursementsCents,
    miscellaneousFeesCents: draft.pricing.miscellaneousFeesCents,
    amountRequestedUpfrontCents: draft.pricing.amountRequestedUpfrontCents,
  });
  const generated = Boolean(pack) && ["generated", "sent", "viewed", "signed"].includes(status);
  const ready = status === "ready";
  const draftStatus = status === "draft";
  const canSend = status === "generated" && pack;

  async function saveDraft() {
    setPending(true);
    const result = await saveAgreementDraftAction(draft);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/agreements");
  }

  async function markReady() {
    setPending(true);
    const result = await markAgreementReadyAction(draft);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function generate() {
    setPending(true);
    setError(null);
    const result = await generateAgreementAction(draft.agreementId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          tone={
            status === "signed"
              ? "accent"
              : ["sent", "viewed", "ready"].includes(status)
                ? "warning"
                : status === "declined" || status === "failed"
                  ? "danger"
                  : "neutral"
          }
        >
          {status.replaceAll("_", " ")}
        </Badge>
        <span className="text-sm text-ink-muted">
          {template.label} · Victoria · {template.version}
        </span>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {draftStatus && !hasActiveAttachment ? (
        <Notice tone="warning">
          <p className="font-medium">Required attachment missing</p>
          <p>
            The Victorian costs information sheet must be uploaded before this
            agreement can be generated.
          </p>
          <a
            href="/settings/attachment"
            className="inline-flex h-10 items-center bg-accent px-4 text-sm font-medium text-paper-raised hover:bg-accent-hover"
          >
            Upload required attachment
          </a>
        </Notice>
      ) : null}

      {ready && frozenAttachmentMissing ? (
        <Notice tone="warning">
          <p className="font-medium">Required attachment missing from this version.</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => reopenAgreementDraftAction(draft.agreementId)}
          >
            Edit and create new version
          </Button>
        </Notice>
      ) : null}

      {generated ? (
        <section className="space-y-4">
          <h2 className="font-serif text-xl">Generated pack</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Agreement version</dt>
              <dd>{pack!.versionNumber}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Generated</dt>
              <dd>{formatDocumentDate(pack!.generatedAt)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Template version</dt>
              <dd>{pack!.templateVersion}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Required attachment</dt>
              <dd>
                {pack!.attachmentVersion ? `Version ${pack!.attachmentVersion}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Pages</dt>
              <dd>{pack!.pageCount}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/agreements/${draft.agreementId}/pack`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center border border-rule-strong bg-paper-raised px-4 text-sm font-medium hover:border-ink"
            >
              View PDF
            </a>
            <a
              href={`/agreements/${draft.agreementId}/pack?download=1`}
              className="inline-flex h-10 items-center bg-accent px-4 text-sm font-medium text-paper-raised hover:bg-accent-hover"
            >
              Download PDF
            </a>
          </div>
          <iframe
            title="Generated agreement pack"
            src={`/agreements/${draft.agreementId}/pack`}
            className="h-[80vh] w-full border border-rule bg-paper-raised"
          />
        </section>
      ) : null}

      {canSend || ["sent", "viewed", "signed"].includes(status) ? (
        <SignaturePanel
          agreementId={draft.agreementId}
          agreementStatus={status}
          defaultSignerName={draft.client.fullName}
          defaultSignerEmail={draft.client.email}
          testMode={testMode}
          request={signatureRequest}
          signedDocument={signedDocument}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="font-serif text-xl">Client</h2>
        <p>{draft.client.fullName || "—"}</p>
        <p className="text-sm text-ink-muted">
          {[draft.client.email, draft.client.phone].filter(Boolean).join(" · ") || "No contact yet"}
        </p>
        <p className="text-sm text-ink-muted">
          {[
            draft.client.addressLine1,
            draft.client.suburb,
            draft.client.state,
            draft.client.postcode,
          ]
            .filter(Boolean)
            .join(", ") || "No address yet"}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-xl">Matter</h2>
        <p>
          {draft.matter.referenceNumber || "—"} · {draft.matter.title || "Untitled matter"}
        </p>
        {draft.matter.description ? (
          <p className="text-sm leading-6 text-ink-muted">{draft.matter.description}</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-xl">Responsible practitioner</h2>
        <p>
          {practitioner
            ? `${practitioner.full_name}${practitioner.title ? ` · ${practitioner.title}` : ""}`
            : "Not selected"}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-xl">Scope</h2>
        {draft.generalScopeStatement ? (
          <p className="text-sm leading-6">{draft.generalScopeStatement}</p>
        ) : null}
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {draft.scopeItems
            .filter((item) => item.body.trim())
            .map((item) => (
              <li key={item.id}>{item.body}</li>
            ))}
        </ol>
        {draft.exclusions ? (
          <p className="text-sm text-ink-muted">Exclusions: {draft.exclusions}</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-xl">Pricing</h2>
        {draft.agreementType === "short_form" ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Costs basis</dt>
              <dd>{shortFormBasisLabel(draft.matter.pricingType)}</dd>
            </div>
            {shortFormReviewShowsHourlyRate(draft.matter.pricingType) ? (
              <div>
                <dt className="text-ink-muted">Hourly rate</dt>
                <dd>{formatAudFromCents(draft.pricing.hourlyRateCents)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink-muted">{shortFormFeeLabel(draft.matter.pricingType)}</dt>
              <dd>{formatAudFromCents(draft.pricing.professionalFeesExGstCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Discount</dt>
              <dd>{formatAudFromCents(draft.pricing.discountCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Subtotal</dt>
              <dd>{formatAudFromCents(shortForm.subtotalExGstCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">GST</dt>
              <dd>{formatAudFromCents(shortForm.gstCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Disbursements</dt>
              <dd>{formatAudFromCents(draft.pricing.disbursementsCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total incl GST</dt>
              <dd>{formatAudFromCents(shortForm.totalInclGstCents)}</dd>
            </div>
          </dl>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Solicitor estimates</dt>
              <dd>{formatAudFromCents(staged.solicitorTotalCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Consultant estimates</dt>
              <dd>{formatAudFromCents(staged.consultantTotalCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">GST on solicitor estimates</dt>
              <dd>{formatAudFromCents(staged.gstCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Disbursements</dt>
              <dd>{formatAudFromCents(draft.pricing.disbursementsCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Miscellaneous</dt>
              <dd>{formatAudFromCents(draft.pricing.miscellaneousFeesCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total estimate</dt>
              <dd>{formatAudFromCents(staged.totalEstimateCents)}</dd>
            </div>
          </dl>
        )}
      </section>

      {draft.agreementType === "full_staged" ? (
        <section className="space-y-4">
          <h2 className="font-serif text-xl">Stages</h2>
          {draft.stages.map((stage, index) => (
            <div key={stage.id} className="border-t border-rule pt-4">
              <p className="font-medium">
                Stage {index + 1}
                {stage.title ? ` · ${stage.title}` : ""}
              </p>
              {stage.timing ? <p className="text-sm text-ink-muted">{stage.timing}</p> : null}
              <p className="mt-2 text-sm tabular-nums">
                Solicitor {formatAudFromCents(stage.solicitorCostEstimateCents)} · Consultant{" "}
                {formatAudFromCents(stage.consultantEstimateCents)}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-serif text-xl">Amount requested upfront</h2>
        <p className="tabular-nums">
          {formatAudFromCents(draft.pricing.amountRequestedUpfrontCents)}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        {draftStatus ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => reopenAgreementDraftAction(draft.agreementId)}
            >
              Edit
            </Button>
            <Button type="button" variant="secondary" onClick={saveDraft} disabled={pending}>
              Save draft
            </Button>
            <Button
              type="button"
              onClick={markReady}
              disabled={pending || !hasActiveAttachment}
            >
              Mark ready
            </Button>
          </>
        ) : null}
        {ready && !frozenAttachmentMissing ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => reopenAgreementDraftAction(draft.agreementId)}
            >
              Edit
            </Button>
            <Button type="button" onClick={generate} disabled={pending}>
              Generate agreement
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
