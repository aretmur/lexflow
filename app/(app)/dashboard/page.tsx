import type { Metadata } from "next";
import { requireFirm } from "@/lib/auth/session";
import { loadDashboard } from "@/lib/dashboard";
import { formatAudFromCents } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Metric } from "@/components/ui/metric";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { FundingDisclaimer } from "@/components/funding-disclaimer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
};

function agreementTone(status: string) {
  if (status === "declined") return "danger" as const;
  if (status === "sent" || status === "viewed") return "warning" as const;
  return "neutral" as const;
}

export default async function DashboardPage() {
  const { firm } = await requireFirm();
  const dashboard = await loadDashboard(firm.id);

  return (
    <div className="space-y-12">
      <PageHeader
        title="Dashboard"
        description="The firm’s position from instructions to signed and funded."
      />

      <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Active matters" value={String(dashboard.metrics.activeMatters)} />
        <Metric
          label="Agreed / estimated fees"
          value={formatAudFromCents(dashboard.metrics.agreedOrEstimatedFeesCents)}
        />
        <Metric
          label="Funds requested"
          value={formatAudFromCents(dashboard.metrics.fundsRequestedCents)}
        />
        <Metric
          label="Funds received"
          value={formatAudFromCents(dashboard.metrics.fundsReceivedCents)}
        />
        <Metric
          label="Outstanding requested funds"
          value={formatAudFromCents(dashboard.metrics.outstandingRequestedFundsCents)}
        />
        <Metric
          label="Agreements awaiting signature"
          value={String(dashboard.metrics.agreementsAwaitingSignature)}
          hint={`Not yet requested ${formatAudFromCents(dashboard.metrics.notYetRequestedCents)}`}
        />
      </section>

      <FundingDisclaimer />

      <section className="space-y-4">
        <h2 className="font-serif text-xl text-ink">Money to chase</h2>
        {dashboard.moneyToChase.length === 0 ? (
          <EmptyState
            title="Nothing to chase"
            description="Outstanding requested funds will appear here once funding requests are sent and receipts are recorded."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Matter</Th>
                <Th>Requested</Th>
                <Th>Received</Th>
                <Th>Outstanding</Th>
                <Th>Days outstanding</Th>
              </tr>
            </thead>
            <tbody>
              {dashboard.moneyToChase.map((row) => (
                <tr key={row.requestId}>
                  <Td>
                    {row.clientId ? (
                      <Link href={`/clients/${row.clientId}`} className="hover:underline">
                        {row.clientName}
                      </Link>
                    ) : (
                      row.clientName
                    )}
                  </Td>
                  <Td>
                    <Link href={`/matters/${row.matterId}`} className="hover:underline">
                      {row.matterNumber} · {row.matterTitle}
                    </Link>
                  </Td>
                  <Td className="tabular-nums">
                    {formatAudFromCents(row.requestedCents)}
                  </Td>
                  <Td className="tabular-nums">
                    {formatAudFromCents(row.receivedCents)}
                  </Td>
                  <Td className="tabular-nums">
                    {formatAudFromCents(row.outstandingCents)}
                  </Td>
                  <Td className="tabular-nums">{row.daysOutstanding}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl text-ink">Agreements requiring attention</h2>
        {dashboard.agreementsRequiringAttention.length === 0 ? (
          <EmptyState
            title="No agreements need attention"
            description="Draft, sent, viewed and declined agreements will be listed here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Matter</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {dashboard.agreementsRequiringAttention.map((row) => (
                <tr key={row.id}>
                  <Td>{row.clientName}</Td>
                  <Td>
                    <Link href={`/matters/${row.matterId}`} className="hover:underline">
                      {row.matterNumber} · {row.matterTitle}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={agreementTone(row.status)}>
                      {row.status.replaceAll("_", " ")}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
