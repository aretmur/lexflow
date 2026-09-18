import { requireUser } from "@/lib/auth/session";
import { SettingsNav } from "@/components/layout/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="space-y-8">
      <SettingsNav />
      {children}
    </div>
  );
}
