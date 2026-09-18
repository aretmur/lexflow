export type Cents = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of cents`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} exceeds a safe integer`);
  }
  return value;
}

export function assertNonNegativeCents(value: number, label = "amount"): Cents {
  const cents = assertCents(value, label);
  if (cents < 0) {
    throw new MoneyError(`${label} cannot be negative`);
  }
  return cents;
}

export function addCents(left: Cents, right: Cents): Cents {
  return assertCents(assertCents(left) + assertCents(right), "sum");
}

export function subtractCents(left: Cents, right: Cents): Cents {
  return assertCents(assertCents(left) - assertCents(right), "difference");
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce<Cents>((total, value) => addCents(total, value), 0);
}

export function formatAudFromCents(cents: Cents): string {
  const amount = assertCents(cents);
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  const grouped = dollars.toLocaleString("en-AU");
  return `${negative ? "-" : ""}$${grouped}.${remainder.toString().padStart(2, "0")}`;
}

export function parseAudToCents(input: string): Cents {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new MoneyError("Amount is required");
  }

  const negative = trimmed.startsWith("-");
  const normalized = trimmed.replace(/[$,\s]/g, "").replace(/^-/, "");

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new MoneyError("Amount must be a dollar value with up to two decimal places");
  }

  const [dollarPart, fractionPart = ""] = normalized.split(".");
  const cents = assertCents(
    Number.parseInt(dollarPart, 10) * 100 + Number.parseInt(fractionPart.padEnd(2, "0") || "0", 10),
    "parsed amount",
  );

  return negative ? -cents : cents;
}
