export const APP_NAME = "Lexflow";
export const APP_PROPOSITION = "From instructions to signed and funded.";

export const FUNDING_WORKFLOW_DISCLAIMER =
  "Lexflow funding records are workflow records only and do not replace the law practice's statutory trust accounting records.";

export const LEGAL_REVIEW_NOTICE =
  "UNDER LEGAL REVIEW — Lexflow templates are not approved Victorian (or other Australian) legal drafting. Do not treat generated or stored wording as approved legal content.";

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { url, anonKey };
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
