export function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || "";
}

export function getEmailReplyTo() {
  return process.env.EMAIL_REPLY_TO?.trim() || "";
}

export function isExplicitConsoleEmail() {
  return process.env.EMAIL_PROVIDER?.trim() === "console";
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
