import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { FundingDisclaimer } from "@/components/funding-disclaimer";
import { PaymentForm } from "@/app/(app)/settings/payment/payment-form";

export const metadata: Metadata = {
  title: "Trust / payment",
};

export default async function PaymentSettingsPage() {
  const { firm } = await requireFirm();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Trust / payment details"
        description="These details can be reused in generated agreements. They are workflow records only."
      />
      <FundingDisclaimer />
      <PaymentForm firm={firm} />
    </div>
  );
}
