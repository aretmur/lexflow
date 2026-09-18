import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-3xl">{APP_NAME}</p>
      <p className="mt-4 text-sm text-ink-muted">
        That record is not available in this firm.
      </p>
      <Link href="/dashboard" className="mt-8 text-sm hover:underline">
        Return to dashboard
      </Link>
    </div>
  );
}
