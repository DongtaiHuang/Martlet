import Link from "next/link";
import { getDataMode } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/auth";
import { SignOutButton } from "./SignOutButton";

/** Server component for the nav: "Demo mode", a sign-in link, or the user's name + sign out. */
export async function AuthStatus() {
  if (getDataMode() === "mock") {
    return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Demo mode</span>;
  }

  const user = await getCurrentUser();
  if (!user) {
    return <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Sign in</Link>;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-neutral-700">{user.display_name}</span>
      <SignOutButton />
    </div>
  );
}
