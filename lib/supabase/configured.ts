function isPlaceholder(value: string | undefined) {
  if (!value) {
    return true;
  }
  return /placeholder|your-project-ref|your-anon-key|your.publishable.key/i.test(
    value,
  );
}

export function getSupabaseConfigState() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = !isPlaceholder(url) && !isPlaceholder(anonKey);
  return {
    url: url ?? "",
    configured,
  };
}

export function isSupabaseConfigured() {
  return getSupabaseConfigState().configured;
}
