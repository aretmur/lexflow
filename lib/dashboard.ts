import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  calculateMatterFunding,
  daysOutstanding,
  isCountedFundingRequestStatus,
} from "@/lib/funding";
import {
  ACTIVE_MATTER_STATUSES,
  AGREEMENTS_AWAITING_SIGNATURE_STATUSES,
  AGREEMENTS_REQUIRING_ATTENTION_STATUSES,
} from "@/lib/types/enums";
import type {
  Client,
  CostsAgreement,
  FundingReceipt,
  FundingRequest,
  Matter,
} from "@/lib/types/database";
import type { Cents } from "@/lib/money";

export type DashboardMetrics = {
  activeMatters: number;
  agreedOrEstimatedFeesCents: Cents;
  fundsRequestedCents: Cents;
  fundsReceivedCents: Cents;
  outstandingRequestedFundsCents: Cents;
  notYetRequestedCents: Cents;
  agreementsAwaitingSignature: number;
};

export type MoneyToChaseRow = {
  requestId: string;
  clientId: string;
  clientName: string;
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  requestedCents: Cents;
  receivedCents: Cents;
  outstandingCents: Cents;
  daysOutstanding: number;
};

export type AgreementAttentionRow = {
  id: string;
  status: CostsAgreement["status"];
  matterId: string;
  matterNumber: string;
  matterTitle: string;
  clientName: string;
  updatedAt: string;
};

export type DashboardData = {
  metrics: DashboardMetrics;
  moneyToChase: MoneyToChaseRow[];
  agreementsRequiringAttention: AgreementAttentionRow[];
};

const emptyMetrics: DashboardMetrics = {
  activeMatters: 0,
  agreedOrEstimatedFeesCents: 0,
  fundsRequestedCents: 0,
  fundsReceivedCents: 0,
  outstandingRequestedFundsCents: 0,
  notYetRequestedCents: 0,
  agreementsAwaitingSignature: 0,
};

export async function loadDashboard(firmId: string): Promise<DashboardData> {
  const supabase = await createServerSupabaseClient();

  const [
    mattersResult,
    requestsResult,
    receiptsResult,
    agreementsResult,
    clientsResult,
  ] = await Promise.all([
    supabase
      .from("matters")
      .select(
        "id, client_id, matter_number, matter_title, agreed_or_estimated_cost_cents, status",
      )
      .eq("firm_id", firmId),
    supabase
      .from("funding_requests")
      .select(
        "id, matter_id, amount_requested_cents, date_requested, due_date, status",
      )
      .eq("firm_id", firmId),
    supabase
      .from("funding_receipts")
      .select("id, matter_id, funding_request_id, amount_received_cents")
      .eq("firm_id", firmId),
    supabase
      .from("costs_agreements")
      .select("id, matter_id, status, updated_at")
      .eq("firm_id", firmId),
    supabase.from("clients").select("id, display_name").eq("firm_id", firmId),
  ]);

  if (
    mattersResult.error ||
    requestsResult.error ||
    receiptsResult.error ||
    agreementsResult.error ||
    clientsResult.error
  ) {
    throw new Error(
      mattersResult.error?.message ??
        requestsResult.error?.message ??
        receiptsResult.error?.message ??
        agreementsResult.error?.message ??
        clientsResult.error?.message ??
        "Unable to load dashboard",
    );
  }

  const matters = mattersResult.data as Pick<
    Matter,
    | "id"
    | "client_id"
    | "matter_number"
    | "matter_title"
    | "agreed_or_estimated_cost_cents"
    | "status"
  >[];
  const requests = requestsResult.data as Pick<
    FundingRequest,
    | "id"
    | "matter_id"
    | "amount_requested_cents"
    | "date_requested"
    | "due_date"
    | "status"
  >[];
  const receipts = receiptsResult.data as Pick<
    FundingReceipt,
    "id" | "matter_id" | "funding_request_id" | "amount_received_cents"
  >[];
  const agreements = agreementsResult.data as Pick<
    CostsAgreement,
    "id" | "matter_id" | "status" | "updated_at"
  >[];
  const clients = clientsResult.data as Pick<Client, "id" | "display_name">[];

  if (
    matters.length === 0 &&
    requests.length === 0 &&
    receipts.length === 0 &&
    agreements.length === 0
  ) {
    return {
      metrics: emptyMetrics,
      moneyToChase: [],
      agreementsRequiringAttention: [],
    };
  }

  const clientNames = new Map(clients.map((client) => [client.id, client.display_name]));
  const matterById = new Map(matters.map((matter) => [matter.id, matter]));

  const countedRequests = requests.filter((request) =>
    isCountedFundingRequestStatus(request.status),
  );
  const fundsRequestedCents = countedRequests.reduce(
    (total, request) => total + request.amount_requested_cents,
    0,
  );
  const fundsReceivedCents = receipts.reduce(
    (total, receipt) => total + receipt.amount_received_cents,
    0,
  );
  const fundsReceivedAgainstRequestsCents = receipts
    .filter((receipt) => receipt.funding_request_id)
    .reduce((total, receipt) => total + receipt.amount_received_cents, 0);
  const agreedOrEstimatedFeesCents = matters
    .filter((matter) =>
      (ACTIVE_MATTER_STATUSES as readonly string[]).includes(matter.status),
    )
    .reduce((total, matter) => total + matter.agreed_or_estimated_cost_cents, 0);

  const funding = calculateMatterFunding({
    agreedOrEstimatedCostCents: agreedOrEstimatedFeesCents,
    fundsRequestedCents,
    fundsReceivedCents,
    fundsReceivedAgainstRequestsCents,
  });

  const receivedByRequest = new Map<string, number>();
  for (const receipt of receipts) {
    if (!receipt.funding_request_id) {
      continue;
    }
    receivedByRequest.set(
      receipt.funding_request_id,
      (receivedByRequest.get(receipt.funding_request_id) ?? 0) +
        receipt.amount_received_cents,
    );
  }

  const moneyToChase: MoneyToChaseRow[] = countedRequests
    .map((request) => {
      const received = receivedByRequest.get(request.id) ?? 0;
      const outstanding = calculateMatterFunding({
        agreedOrEstimatedCostCents: 0,
        fundsRequestedCents: request.amount_requested_cents,
        fundsReceivedCents: received,
        fundsReceivedAgainstRequestsCents: received,
      }).outstandingRequestedFundsCents;
      const matter = matterById.get(request.matter_id);
      return {
        requestId: request.id,
        clientId: matter?.client_id ?? "",
        clientName: matter ? (clientNames.get(matter.client_id) ?? "Unknown client") : "Unknown client",
        matterId: request.matter_id,
        matterNumber: matter?.matter_number ?? "—",
        matterTitle: matter?.matter_title ?? "Unknown matter",
        requestedCents: request.amount_requested_cents,
        receivedCents: received,
        outstandingCents: outstanding,
        daysOutstanding: daysOutstanding(request.due_date ?? request.date_requested),
      };
    })
    .filter((row) => row.outstandingCents > 0)
    .sort((left, right) => right.daysOutstanding - left.daysOutstanding);

  const agreementsRequiringAttention: AgreementAttentionRow[] = agreements
    .filter((agreement) =>
      (AGREEMENTS_REQUIRING_ATTENTION_STATUSES as readonly string[]).includes(
        agreement.status,
      ),
    )
    .map((agreement) => {
      const matter = matterById.get(agreement.matter_id);
      return {
        id: agreement.id,
        status: agreement.status,
        matterId: agreement.matter_id,
        matterNumber: matter?.matter_number ?? "—",
        matterTitle: matter?.matter_title ?? "Unknown matter",
        clientName: matter
          ? (clientNames.get(matter.client_id) ?? "Unknown client")
          : "Unknown client",
        updatedAt: agreement.updated_at,
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return {
    metrics: {
      activeMatters: matters.filter((matter) =>
        (ACTIVE_MATTER_STATUSES as readonly string[]).includes(matter.status),
      ).length,
      agreedOrEstimatedFeesCents: funding.agreedOrEstimatedCostCents,
      fundsRequestedCents: funding.fundsRequestedCents,
      fundsReceivedCents: funding.fundsReceivedCents,
      outstandingRequestedFundsCents: funding.outstandingRequestedFundsCents,
      notYetRequestedCents: funding.notYetRequestedCents,
      agreementsAwaitingSignature: agreements.filter((agreement) =>
        (AGREEMENTS_AWAITING_SIGNATURE_STATUSES as readonly string[]).includes(
          agreement.status,
        ),
      ).length,
    },
    moneyToChase,
    agreementsRequiringAttention,
  };
}
