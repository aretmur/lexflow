export type EmailProviderName = "microsoft_graph" | "resend" | "console";

export function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || "";
}

export function getEmailReplyTo() {
  return process.env.EMAIL_REPLY_TO?.trim() || "";
}

export function getMicrosoftTenantId() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "";
}

export function getMicrosoftClientId() {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || "";
}

export function getMicrosoftClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() || "";
}

export function getMicrosoftGraphSender() {
  return process.env.MICROSOFT_GRAPH_SENDER?.trim() || "";
}

export function getConfiguredEmailProviderName(): EmailProviderName | "" {
  const value = process.env.EMAIL_PROVIDER?.trim() || "";
  if (value === "microsoft_graph" || value === "resend" || value === "console") {
    return value;
  }
  return "";
}

export function isExplicitConsoleEmail() {
  return getConfiguredEmailProviderName() === "console";
}

export function isProductionEmailRequired() {
  if (isExplicitConsoleEmail()) {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return true;
  }
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    return false;
  }
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

export function hasResendConfig() {
  return Boolean(getResendApiKey() && getEmailFrom());
}

export function hasMicrosoftGraphConfig() {
  return Boolean(
    getMicrosoftTenantId() &&
      getMicrosoftClientId() &&
      getMicrosoftClientSecret() &&
      getMicrosoftGraphSender(),
  );
}

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

export function emailsMatch(left?: string | null, right?: string | null) {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  return Boolean(a) && a === b;
}
