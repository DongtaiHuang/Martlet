import Link from "next/link";
import { getDataMode } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/auth";
import { SignOutButton } from "./SignOutButton";

/** Server-rendered sign-in/up controls, or authenticated profile + sign-out. */
export async function AuthStatus() {
  if (getDataMode() === "mock") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Demo mode</span>
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700">Sign in</Link>
        <Link href="/signup" className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700">Sign up</Link>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700">Sign in</Link>
        <Link href="/signup" className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-red-700">Sign up</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-neutral-700">{user.display_name}</span>
      <SignOutButton />
    </div>
  );
}
