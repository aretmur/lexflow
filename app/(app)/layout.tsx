import { requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireUser();

  return (
    <AppShell
      firmName={context.firm?.practice_name ?? context.firm?.name ?? null}
      userEmail={context.user.email}
    >
      {children}
    </AppShell>
  );
}
