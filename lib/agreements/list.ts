const MELBOURNE = "Australia/Melbourne";

export function canDiscardCostsAgreement(status: string) {
  return status !== "signed";
}

export function agreementMonthLabel(iso: string) {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: MELBOURNE,
  }).format(new Date(iso));
}

export function agreementMonthKey(iso: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "2-digit",
    timeZone: MELBOURNE,
  }).formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export function groupAgreementsByMonth<T extends { createdAt: string }>(
  items: T[],
): Array<{ key: string; label: string; items: T[] }> {
  const groups = new Map<string, { key: string; label: string; items: T[] }>();
  const sorted = [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  for (const item of sorted) {
    const key = agreementMonthKey(item.createdAt);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(key, {
      key,
      label: agreementMonthLabel(item.createdAt),
      items: [item],
    });
  }
  return [...groups.values()].sort((left, right) => right.key.localeCompare(left.key));
}

export const DISCARD_SIGNED_ERROR =
  "A signed costs agreement cannot be deleted. It is kept as the executed record.";

export const DISCARD_MISSING_ERROR = "Agreement not found.";
