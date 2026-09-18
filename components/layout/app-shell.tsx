import { Sidebar } from "@/components/layout/sidebar";
import { logoutAction } from "@/app/actions/auth";

export function AppShell({
  firmName,
  userEmail,
  children,
}: {
  firmName: string | null;
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full lg:flex">
      <div className="lg:sticky lg:top-0 lg:h-dvh lg:shrink-0">
        <Sidebar firmName={firmName} userEmail={userEmail} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-rule px-6 py-3 lg:hidden">
          <p className="truncate text-sm text-ink">{firmName ?? "No firm yet"}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.14em] text-ink-muted"
            >
              Sign out
            </button>
          </form>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
