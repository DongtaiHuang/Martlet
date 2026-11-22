import Link from "next/link";
import { Bird } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { MartletNavLinks } from "./MartletNavLinks";

/** Server component: render session-aware controls alongside the client-side active links. */
export function MartletNav() {
  return (
    <header className="border-b border-line bg-surface text-ink-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-3 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-3">
        <Link href="/meetups" className="inline-flex min-h-11 w-fit items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-focus">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand"><Bird aria-hidden="true" size={21} /></span>
          McGill Martlet
        </Link>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <MartletNavLinks />
          <div className="flex min-h-10 items-center gap-2"><AuthStatus /></div>
        </div>
      </div>
    </header>
  );
}
