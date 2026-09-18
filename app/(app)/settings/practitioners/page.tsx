import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { PractitionerForm } from "@/app/(app)/settings/practitioners/practitioner-form";

export const metadata: Metadata = {
  title: "Practitioners",
};

export default async function PractitionersPage() {
  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();
  const { data: practitioners, error } = await supabase
    .from("practitioners")
    .select(
      "id, full_name, title, email, mobile, default_hourly_rate_cents, is_active",
    )
    .eq("firm_id", firm.id)
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Practitioners"
        description="People who can be named as the responsible practitioner on an agreement."
      />
      <div className="space-y-6">
        {(practitioners ?? []).map((practitioner) => (
          <PractitionerForm key={practitioner.id} practitioner={practitioner} />
        ))}
        <PractitionerForm />
      </div>
    </div>
  );
}
