import Link from "next/link";
import { Bird, Plus } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { isModerator } from "@/lib/board";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AccountMenu } from "./AccountMenu";
import { MartletNavLinks } from "./MartletNavLinks";
import { ThemeSwitch } from "./ThemeSwitch";

/**
 * The header, one row on every screen size: logo, the main sections (a bottom tab bar on phones),
 * then Create, notifications and your account menu (or Sign in) on the right.
 */
export async function MartletNav() {
  const user = getDataMode() === "live" ? await getCurrentUser().catch(() => null) : null;
  const moderator = user ? await isModerator().catch(() => false) : false;

  return (
    <header className="border-b border-line bg-surface text-ink-soft">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:gap-3 sm:px-8 sm:py-3">
        <Link href="/meetups" className="inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight whitespace-nowrap focus-visible:outline-2 focus-visible:outline-focus">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand"><Bird aria-hidden="true" size={21} /></span>
          {/* Tablets need the room for the tabs: the logo alone links home there. */}
          <span className="sm:max-lg:sr-only">McGill Martlet</span>
        </Link>
        <MartletNavLinks />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/meetups/new" className="hidden min-h-11 items-center gap-1.5 rounded-xl bg-brand px-3 text-sm font-bold whitespace-nowrap text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:inline-flex lg:px-4">
            <Plus aria-hidden="true" size={16} /> <span className="max-md:sr-only">Create</span>
          </Link>
          {user && <NotificationBell />}
          {user ? (
            <AccountMenu name={user.display_name || "Martlet Student"} moderator={moderator} />
          ) : (
            <>
              <ThemeSwitch />
              <AuthStatus user={null} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
