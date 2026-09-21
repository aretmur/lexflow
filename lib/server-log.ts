export function logServerError(
  event: string,
  details: Record<string, string | number | boolean | undefined | null>,
) {
  console.error(`[lexflow] ${event}`, details);
}

export function publicActionError(message: string | undefined, fallback: string) {
  if (!message?.trim()) {
    return fallback;
  }
  if (
    /password|secret|service.role|apikey|api_key|bearer\s|postgres:\/\//i.test(
      message,
    )
  ) {
    return fallback;
  }
  return message.replace(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    "[redacted]",
  );
}

export function isNextNavigationError(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = String((error as { digest?: unknown }).digest ?? "");
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}
