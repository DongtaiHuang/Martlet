import Link from "next/link";
import { Bird } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { isModerator } from "@/lib/board";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MartletNavLinks } from "./MartletNavLinks";
import { ThemeSwitch } from "./ThemeSwitch";

/** Server component: render session-aware controls alongside the client-side active links. */
export async function MartletNav() {
  // Looked up once here and shared: the Profile link shows the name, AuthStatus shows sign-in/out.
  const user = getDataMode() === "live" ? await getCurrentUser().catch(() => null) : null;
  const moderator = user ? await isModerator().catch(() => false) : false;

  return (
    <header className="border-b border-line bg-surface text-ink-soft">
      {/* Phone: one compact row (logo, bell, menu) + a bottom tab bar. sm–xl: logo row + links row. xl: one row. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-8 sm:py-3">
        <Link href="/meetups" className="order-1 inline-flex min-h-11 w-fit items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight whitespace-nowrap focus-visible:outline-2 focus-visible:outline-focus">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand"><Bird aria-hidden="true" size={21} /></span>
          Martlet
        </Link>
        <div className="order-2 ml-auto flex min-h-10 flex-wrap items-center justify-end gap-2 xl:order-3 xl:ml-0">
          <NotificationBell />
          <div className="hidden sm:block"><AuthStatus user={user} /></div>
          {/* Phones: Light/Dark/System and sign in/out live inside the palette menu. */}
          <ThemeSwitch account={<AuthStatus user={user} />} />
        </div>
        <div className="order-3 min-w-0 sm:w-full xl:order-2 xl:ml-auto xl:w-auto"><MartletNavLinks profileName={user?.display_name} moderator={moderator} /></div>
      </div>
    </header>
  );
}
