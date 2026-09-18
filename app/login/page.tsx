import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";
import { APP_NAME, APP_PROPOSITION } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/agreements";
  const authError = params.error === "auth";

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="font-serif text-4xl tracking-tight text-ink">{APP_NAME}</p>
        <p className="mt-3 text-sm leading-6 text-ink-muted">{APP_PROPOSITION}</p>
        {authError ? (
          <p className="mt-6 text-sm text-danger">
            Sign-in could not be completed. Please try again.
          </p>
        ) : null}
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
