import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Firm, FirmMembership, UserProfile } from "@/lib/types/database";

export type AppContext = {
  user: { id: string; email: string };
  profile: UserProfile | null;
  membership: FirmMembership | null;
  firm: Firm | null;
};

export async function getAppContext(): Promise<AppContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("firm_memberships")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let firm: Firm | null = null;
  if (membership) {
    const { data } = await supabase
      .from("firms")
      .select("*")
      .eq("id", membership.firm_id)
      .maybeSingle();
    firm = data;
  }

  return {
    user: { id: user.id, email: user.email ?? profile?.email ?? "" },
    profile,
    membership,
    firm,
  };
}

export async function requireUser(): Promise<AppContext> {
  const context = await getAppContext();
  if (!context) {
    redirect("/login");
  }
  return context;
}

export async function requireFirm(): Promise<
  AppContext & { firm: Firm; membership: FirmMembership }
> {
  const context = await requireUser();
  if (!context.firm || !context.membership) {
    redirect("/settings/firm");
  }
  return {
    ...context,
    firm: context.firm,
    membership: context.membership,
  };
}
