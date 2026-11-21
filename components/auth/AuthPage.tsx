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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <MartletNav />
      <main className="mx-auto max-w-md px-5 py-10">
        <p className="text-sm font-bold uppercase tracking-widest text-red-700">McGill Martlet</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {mode === "signup" ? "Create your account" : "Sign in"}
        </h1>

        {getDataMode() === "mock" && (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Demo mode: Supabase is not configured, so accounts are disabled. Add the variables from
            <code className="mx-1">.env.example</code> to <code className="mx-1">.env.local</code> to enable sign-in.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
        )}

        {user ? (
          <div className="mt-6 space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
            <p>Signed in as <strong>{user.display_name}</strong>{user.email && <> ({user.email})</>}.</p>
            <div className="flex items-center gap-3">
              <Link href={next ?? "/meetups"} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800">
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
