import Link from "next/link";
import { MartletNav } from "@/components/layout/MartletNav";
import { getDataMode } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/auth";
import { safeRedirectPath } from "@/lib/supabase/redirect";
import { AuthForm } from "./AuthForm";
import { SignOutButton } from "./SignOutButton";

export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: "login" | "signup";
  searchParams: { next?: string | string[]; error?: string | string[] };
}) {
  const next = typeof searchParams.next === "string" ? safeRedirectPath(searchParams.next) : undefined;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-canvas text-ink-soft">
      <MartletNav />
      <main className="mx-auto max-w-md px-5 py-10">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-ink">McGill Martlet</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {mode === "signup" ? "Create your account" : "Sign in"}
        </h1>

        {getDataMode() === "mock" && (
          <p className="mt-6 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">
            Demo mode: Supabase is not configured, so accounts are disabled. Add the variables from
            <code className="mx-1">.env.example</code> to <code className="mx-1">.env.local</code> to enable sign-in.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-brand-line bg-brand-soft p-3 text-sm text-brand-ink">{error}</p>
        )}

        {user ? (
          <div className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5">
            <p>Signed in as <strong>{user.display_name}</strong>{user.email && <> ({user.email})</>}.</p>
            <div className="flex items-center gap-3">
              <Link href={next ?? "/meetups"} className="rounded-xl bg-brand px-4 py-2 font-semibold text-on-brand hover:bg-brand">
                Continue
              </Link>
              <SignOutButton />
            </div>
          </div>
        ) : (
          <AuthForm mode={mode} next={next} />
        )}
      </main>
    </div>
  );
}
