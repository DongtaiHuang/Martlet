import Link from "next/link";
import { getDataMode } from "@/lib/supabase/env";
import type { CurrentUser } from "@/lib/supabase/auth";
import { SignOutButton } from "./SignOutButton";

/**
 * Sign-in/up links, or sign-out when signed in. The signed-in user's name is shown on the
 * Profile nav link instead (MartletNav looks the user up once and passes it to both).
 */
export function AuthStatus({ user }: { user: CurrentUser | null }) {
  if (getDataMode() === "mock") {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="hidden rounded-full bg-warn-muted px-3 py-1 text-xs font-semibold text-warn-ink lg:inline">Demo mode</span>
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Sign in</Link>
        <Link href="/signup" className="hidden rounded-lg border border-brand-line lg:inline px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Sign up</Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Sign in</Link>
        <Link href="/signup" className="hidden rounded-lg bg-brand lg:inline px-3 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-focus">Sign up</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <SignOutButton />
    </div>
  );
}
