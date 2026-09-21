"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const SETTINGS_LINKS = [
  { href: "/settings/firm", label: "Firm" },
  { href: "/settings/practitioners", label: "Practitioners" },
  { href: "/settings/payment", label: "Trust / payment" },
  { href: "/settings/signing", label: "Signing" },
  { href: "/settings/attachment", label: "Required attachment" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6 overflow-x-auto border-b border-rule">
      {SETTINGS_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 border-b-2 py-3 text-sm",
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
