"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bird, Compass, House, Plus, UserRound } from "lucide-react";

const links = [
  { href: "/meetups", label: "Feed", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/meetups/new", label: "Create", icon: Plus },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function MartletNav() {
  const pathname = usePathname();
  const activePath = pathname.startsWith("/meetups/") && pathname !== "/meetups/new" ? "/meetups" : pathname;

  return (
    <header className="border-b border-stone-200 bg-white text-stone-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-3">
        <Link href="/meetups" className="inline-flex min-h-11 w-fit items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-red-700">
          <span className="grid size-9 place-items-center rounded-xl bg-red-800 text-white"><Bird aria-hidden="true" size={21} /></span>
          McGill Martlet
        </Link>
        <nav aria-label="Martlet navigation" className="grid grid-cols-4 gap-1 pb-2 sm:flex sm:pb-0">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={activePath === href ? (pathname === href ? "page" : "location") : undefined} className={`flex min-h-11 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-red-700 sm:gap-2 sm:px-3 sm:text-sm ${activePath === href ? "bg-red-50 text-red-900" : "text-stone-600 hover:bg-stone-100"}`}>
              <Icon aria-hidden="true" size={16} className="shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
