import Link from "next/link";
import { Bird } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MartletNavLinks } from "./MartletNavLinks";
import { ThemeSwitch } from "./ThemeSwitch";

/** Server component: render session-aware controls alongside the client-side active links. */
export function MartletNav() {
  return (
    <header className="border-b border-line bg-surface text-ink-soft">
      {/* < xl: row 1 = logo + account/theme, row 2 = links. xl: one row. Rendered once; order does the layout. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 pb-2 sm:px-8 sm:py-3">
        <Link href="/meetups" className="order-1 inline-flex min-h-11 w-fit items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight whitespace-nowrap focus-visible:outline-2 focus-visible:outline-focus">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand"><Bird aria-hidden="true" size={21} /></span>
          McGill Martlet
        </Link>
        <div className="order-2 ml-auto flex min-h-10 flex-wrap items-center justify-end gap-2 xl:order-3 xl:ml-0"><NotificationBell /><AuthStatus /><ThemeSwitch /></div>
        <div className="order-3 w-full min-w-0 xl:order-2 xl:ml-auto xl:w-auto"><MartletNavLinks /></div>
      </div>
    </header>
  );
}
