import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { createAgreementDraftAction } from "@/app/actions/agreements";
import { PageHeader } from "@/components/layout/page-header";
import { LegalReviewNotice } from "@/components/legal-review-notice";
import { Button } from "@/components/ui/button";

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
      <div className="grid gap-6 md:grid-cols-2">
        <form action={createAgreementDraftAction} className="space-y-4 border border-rule p-6">
          <input type="hidden" name="agreementType" value="short_form" />
          <h2 className="font-serif text-2xl">Short form</h2>
          <p className="text-sm leading-6 text-ink-muted">
            Hourly rate, estimated professional fees, GST and an amount requested upfront.
          </p>
          <Button type="submit">Use short form</Button>
        </form>
        <form action={createAgreementDraftAction} className="space-y-4 border border-rule p-6">
          <input type="hidden" name="agreementType" value="full_staged" />
          <h2 className="font-serif text-2xl">Full / staged</h2>
          <p className="text-sm leading-6 text-ink-muted">
            Rates, multiple stages, consultant ranges and a total estimate.
          </p>
          <Button type="submit">Use full / staged</Button>
        </form>
      </div>
    </div>
  );
}
