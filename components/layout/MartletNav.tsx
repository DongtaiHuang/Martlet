import Link from "next/link";
import { Bird } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { MartletNavLinks } from "./MartletNavLinks";

/** Server component: render session-aware controls alongside the client-side active links. */
export function MartletNav() {
  return (
    <header className="border-b border-stone-200 bg-white text-stone-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-3 pb-2 sm:px-8 sm:py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <Link href="/meetups" className="inline-flex min-h-11 w-fit items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-red-700">
          <span className="grid size-9 place-items-center rounded-xl bg-red-800 text-white"><Bird aria-hidden="true" size={21} /></span>
          McGill Martlet
        </Link>
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          <MartletNavLinks />
          <div className="flex min-h-10 items-center gap-2"><AuthStatus /></div>
        </div>
      </div>
    </header>
  );
}
