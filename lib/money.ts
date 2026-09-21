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

export function parseOptionalAudToCents(input: string): Cents {
  if (!input.trim()) {
    return 0;
  }
  return assertNonNegativeCents(parseAudToCents(input), "amount");
}

export type MoneyFieldInterpretation =
  | { status: "valid"; cents: Cents }
  | { status: "incomplete" }
  | { status: "invalid"; message: string };

function looksLikeIncompleteMoneyText(text: string): boolean {
  const compact = text.trim().replace(/[$,\s]/g, "");
  return compact === "" || compact === "." || /^\d+\.$/.test(compact) || /^\.\d{0,2}$/.test(compact);
}

export function interpretMoneyFieldText(text: string): MoneyFieldInterpretation {
  try {
    return { status: "valid", cents: parseOptionalAudToCents(text) };
  } catch (caught) {
    if (looksLikeIncompleteMoneyText(text)) {
      return { status: "incomplete" };
    }
    return {
      status: "invalid",
      message: caught instanceof Error ? caught.message : "Invalid amount",
    };
  }
}

export function centsToInputString(cents: Cents): string {
  const amount = assertNonNegativeCents(cents);
  if (amount === 0) {
    return "";
  }
  const dollars = Math.floor(amount / 100);
  const remainder = amount % 100;
  if (remainder === 0) {
    return String(dollars);
  }
  return `${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function gstCentsOnExclusive(exclusiveCents: Cents): Cents {
  const amount = assertNonNegativeCents(exclusiveCents, "exclusive amount");
  const remainder = amount % 10;
  const base = (amount - remainder) / 10;
  return remainder >= 5 ? base + 1 : base;
}
