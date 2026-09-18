"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, APP_PROPOSITION } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/agreements", label: "Agreements" },
  { href: "/settings", label: "Settings" },
] as const;

export function Sidebar({
  firmName,
  userEmail,
}: {
  firmName: string | null;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col border-b border-rule bg-paper-raised lg:w-60 lg:border-b-0 lg:border-r">
      <div className="px-6 py-6">
        <p className="font-serif text-2xl tracking-tight text-ink">{APP_NAME}</p>
        <p className="mt-2 max-w-[12rem] text-xs leading-5 text-ink-muted">
          {APP_PROPOSITION}
        </p>
      </div>

      <div className="px-4 pb-4">
        <Link
          href="/agreements/new"
          className="flex h-10 items-center justify-center bg-accent px-3 text-sm font-medium text-paper-raised hover:bg-accent-hover"
        >
          New Agreement
        </Link>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/settings"
              ? pathname.startsWith("/settings")
              : pathname === item.href ||
                (pathname.startsWith("/agreements") && item.href === "/agreements" && pathname !== "/agreements/new");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-ink text-paper-raised"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-rule px-6 py-5 lg:block">
        <p className="truncate text-sm text-ink">{firmName ?? "No firm yet"}</p>
        <p className="mt-1 truncate text-xs text-ink-muted">{userEmail}</p>
        <form action={logoutAction} className="mt-4">
          <button
            type="submit"
            className="text-xs uppercase tracking-[0.14em] text-ink-muted hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
