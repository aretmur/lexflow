import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFirm } from "@/lib/auth/session";
import { isUuid } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateMatterFunding } from "@/lib/funding";
import { formatAudFromCents } from "@/lib/money";
import { isCountedFundingRequestStatus } from "@/lib/funding";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Metric } from "@/components/ui/metric";
import { Table, Td, Th } from "@/components/ui/table";
import { FundingDisclaimer } from "@/components/funding-disclaimer";

export const metadata: Metadata = {
  title: "Matter",
};

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const { firm } = await requireFirm();
  const supabase = await createServerSupabaseClient();

  const { data: matter } = await supabase
    .from("matters")
    .select("*")
    .eq("firm_id", firm.id)
    .eq("id", id)
    .maybeSingle();

  if (!matter) {
    notFound();
  }

  const [{ data: client }, { data: practitioner }, { data: requests }, { data: receipts }, { data: agreements }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, display_name")
        .eq("firm_id", firm.id)
        .eq("id", matter.client_id)
        .maybeSingle(),
      matter.responsible_practitioner_id
        ? supabase
            .from("practitioners")
            .select("id, full_name")
            .eq("firm_id", firm.id)
            .eq("id", matter.responsible_practitioner_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("funding_requests")
        .select("*")
        .eq("firm_id", firm.id)
        .eq("matter_id", matter.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("funding_receipts")
        .select("*")
        .eq("firm_id", firm.id)
        .eq("matter_id", matter.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("costs_agreements")
        .select("id, status, updated_at")
        .eq("firm_id", firm.id)
        .eq("matter_id", matter.id)
        .is("discarded_at", null)
        .order("created_at", { ascending: false }),
    ]);

  const countedRequests = (requests ?? []).filter((request) =>
    isCountedFundingRequestStatus(request.status),
  );
  const fundsRequestedCents = countedRequests.reduce(
    (total, request) => total + request.amount_requested_cents,
    0,
  );
  const fundsReceivedCents = (receipts ?? []).reduce(
    (total, receipt) => total + receipt.amount_received_cents,
    0,
  );
  const fundsReceivedAgainstRequestsCents = (receipts ?? [])
    .filter((receipt) => receipt.funding_request_id)
    .reduce((total, receipt) => total + receipt.amount_received_cents, 0);

  const funding = calculateMatterFunding({
    agreedOrEstimatedCostCents: matter.agreed_or_estimated_cost_cents,
    fundsRequestedCents,
    fundsReceivedCents,
    fundsReceivedAgainstRequestsCents,
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title={matter.matter_title}
        description={`${matter.matter_number} · ${matter.jurisdiction} · ${matter.pricing_type.replaceAll("_", " ")}`}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge>{matter.status.replaceAll("_", " ")}</Badge>
        {client ? (
          <Link href={`/clients/${client.id}`} className="hover:underline">
            {client.display_name}
          </Link>
        ) : null}
        {practitioner ? <span>{practitioner.full_name}</span> : null}
      </div>

      {matter.matter_description ? (
        <p className="max-w-3xl text-sm leading-6 text-ink-muted">
          {matter.matter_description}
        </p>
      ) : null}

      <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Agreed / estimated costs"
          value={formatAudFromCents(funding.agreedOrEstimatedCostCents)}
        />
        <Metric
          label="Funds requested"
          value={formatAudFromCents(funding.fundsRequestedCents)}
        />
        <Metric
          label="Funds received"
          value={formatAudFromCents(funding.fundsReceivedCents)}
        />
        <Metric
          label="Outstanding requested funds"
          value={formatAudFromCents(funding.outstandingRequestedFundsCents)}
        />
        <Metric
          label="Not yet requested"
          value={formatAudFromCents(funding.notYetRequestedCents)}
        />
      </section>

      <FundingDisclaimer />

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Costs agreements</h2>
        {!agreements?.length ? (
          <EmptyState
            title="No costs agreements"
            description="Agreements for this matter will appear here. The agreement wizard is not yet available."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((agreement) => (
                <tr key={agreement.id}>
                  <Td>
                    <Link href="/agreements" className="hover:underline">
                      <Badge>{agreement.status.replaceAll("_", " ")}</Badge>
                    </Link>
                  </Td>
                  <Td>{new Date(agreement.updated_at).toLocaleDateString("en-AU")}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Funding requests</h2>
        {!requests?.length ? (
          <EmptyState
            title="No funding requests"
            description="Requests sent to the client will be listed here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Amount</Th>
                <Th>Requested</Th>
                <Th>Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <Td className="tabular-nums">
                    {formatAudFromCents(request.amount_requested_cents)}
                  </Td>
                  <Td>{request.date_requested}</Td>
                  <Td>{request.due_date ?? "—"}</Td>
                  <Td>
                    <Badge>{request.status.replaceAll("_", " ")}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Funding receipts</h2>
        {!receipts?.length ? (
          <EmptyState
            title="No receipts recorded"
            description="Manually recorded receipts will appear here as workflow history. They are not statutory trust records."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Amount</Th>
                <Th>Date</Th>
                <Th>Destination</Th>
                <Th>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <Td className="tabular-nums">
                    {formatAudFromCents(receipt.amount_received_cents)}
                  </Td>
                  <Td>{receipt.date_received}</Td>
                  <Td className="capitalize">{receipt.destination_type}</Td>
                  <Td>{receipt.reference ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
