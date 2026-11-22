import Link from "next/link";
import { getDataMode } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/auth";
import { SignOutButton } from "./SignOutButton";

/** Server-rendered sign-in/up controls, or authenticated profile + sign-out. */
export async function AuthStatus() {
  if (getDataMode() === "mock") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-warn-muted px-3 py-1 text-xs font-semibold text-warn-ink">Demo mode</span>
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Sign in</Link>
        <Link href="/signup" className="rounded-lg border border-brand-line px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Sign up</Link>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Sign in</Link>
        <Link href="/signup" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-focus">Sign up</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-ink-2">{user.display_name}</span>
      <SignOutButton />
    </div>
  );
}
