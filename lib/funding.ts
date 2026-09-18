import {
  assertNonNegativeCents,
  subtractCents,
  type Cents,
} from "@/lib/money";

export const COUNTED_FUNDING_REQUEST_STATUSES = [
  "sent",
  "partially_received",
  "received",
] as const;

export type CountedFundingRequestStatus =
  (typeof COUNTED_FUNDING_REQUEST_STATUSES)[number];

export type MatterFundingSnapshot = {
  agreedOrEstimatedCostCents: Cents;
  fundsRequestedCents: Cents;
  fundsReceivedCents: Cents;
  fundsReceivedAgainstRequestsCents: Cents;
};

export type MatterFundingBreakdown = MatterFundingSnapshot & {
  outstandingRequestedFundsCents: Cents;
  notYetRequestedCents: Cents;
};

function nonNegativeOrZero(value: Cents): Cents {
  return value < 0 ? 0 : value;
}

export function outstandingRequestedFundsCents(
  fundsRequestedCents: Cents,
  fundsReceivedAgainstRequestsCents: Cents,
): Cents {
  return nonNegativeOrZero(
    subtractCents(
      assertNonNegativeCents(fundsRequestedCents, "funds requested"),
      assertNonNegativeCents(
        fundsReceivedAgainstRequestsCents,
        "funds received against requests",
      ),
    ),
  );
}

export function notYetRequestedCents(
  agreedOrEstimatedCostCents: Cents,
  fundsRequestedCents: Cents,
): Cents {
  return nonNegativeOrZero(
    subtractCents(
      assertNonNegativeCents(
        agreedOrEstimatedCostCents,
        "agreed or estimated costs",
      ),
      assertNonNegativeCents(fundsRequestedCents, "funds requested"),
    ),
  );
}

export function calculateMatterFunding(
  snapshot: MatterFundingSnapshot,
): MatterFundingBreakdown {
  return {
    agreedOrEstimatedCostCents: assertNonNegativeCents(
      snapshot.agreedOrEstimatedCostCents,
      "agreed or estimated costs",
    ),
    fundsRequestedCents: assertNonNegativeCents(
      snapshot.fundsRequestedCents,
      "funds requested",
    ),
    fundsReceivedCents: assertNonNegativeCents(
      snapshot.fundsReceivedCents,
      "funds received",
    ),
    fundsReceivedAgainstRequestsCents: assertNonNegativeCents(
      snapshot.fundsReceivedAgainstRequestsCents,
      "funds received against requests",
    ),
    outstandingRequestedFundsCents: outstandingRequestedFundsCents(
      snapshot.fundsRequestedCents,
      snapshot.fundsReceivedAgainstRequestsCents,
    ),
    notYetRequestedCents: notYetRequestedCents(
      snapshot.agreedOrEstimatedCostCents,
      snapshot.fundsRequestedCents,
    ),
  };
}

export function isCountedFundingRequestStatus(
  status: string,
): status is CountedFundingRequestStatus {
  return (COUNTED_FUNDING_REQUEST_STATUSES as readonly string[]).includes(
    status,
  );
}

export function daysOutstanding(
  fromDateIso: string,
  now = new Date(),
): number {
  const from = new Date(`${fromDateIso}T00:00:00`);
  if (Number.isNaN(from.getTime())) {
    throw new Error("Invalid outstanding date");
  }

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const milliseconds = startOfToday.getTime() - from.getTime();
  return Math.max(0, Math.floor(milliseconds / 86_400_000));
}
