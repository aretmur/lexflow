import { getSupabaseConfigState } from "@/lib/supabase/configured";
import { Notice } from "@/components/ui/notice";

export function ConnectionNotice() {
  const { configured } = getSupabaseConfigState();
  if (configured) {
    return null;
  }

  return (
    <div className="mb-8">
      <Notice tone="warning">
        Supabase is not connected. Put a real project URL and anon key in `.env.local`, then run
        both SQL migrations in the Supabase SQL editor.
      </Notice>
    </div>
  );
}
