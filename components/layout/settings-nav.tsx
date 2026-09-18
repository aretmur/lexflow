"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const SETTINGS_LINKS = [
  { href: "/settings/firm", label: "Firm" },
  { href: "/settings/practitioners", label: "Practitioners" },
  { href: "/settings/templates", label: "Templates" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6 border-b border-rule">
      {SETTINGS_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "border-b-2 py-3 text-sm",
              active
                ? "border-ink text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
