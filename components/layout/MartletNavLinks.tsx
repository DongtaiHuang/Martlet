"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, Landmark, Plus } from "lucide-react";
import { MORE_PATHS, MoreNavItem } from "./MoreNavItem";

const links = [
  { href: "/meetups", label: "Feed", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  // Phones: Create is the raised centre tab. Larger screens: a button on the right of the header.
  { href: "/meetups/new", label: "Create", icon: Plus, create: true },
  { href: "/landmarks", label: "Landmarks", icon: Landmark },
];
const linkClass = "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-focus sm:min-h-11 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm";

/** The main sections: a bottom tab bar on phones (thumb reach), inline in the header on larger screens. */
export function MartletNavLinks() {
  const pathname = usePathname();
  const activePath = pathname.startsWith("/meetups/") && pathname !== "/meetups/new" ? "/meetups"
    : pathname.startsWith("/landmarks/") ? "/landmarks"
    : MORE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ? "/more" : pathname;
  const current = (href: string) => (activePath === href ? (pathname === href ? "page" : "location") : undefined);
  const tone = (href: string) => (activePath === href ? "bg-brand-soft text-brand-ink-strong" : "text-ink-muted hover:bg-surface-muted hover:text-ink");

  return (
    <nav aria-label="Martlet navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-end gap-0.5 border-t border-line bg-surface/95 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.25)] backdrop-blur-md sm:static sm:flex sm:items-center sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
      {links.map(({ href, label, icon: Icon, ...rest }) =>
        "create" in rest ? (
          <Link key={href} href={href} aria-current={current(href)} className={`${linkClass} text-ink-soft sm:hidden`}>
            <span className={`-mt-5 grid size-12 place-items-center rounded-full text-on-brand shadow-lg ring-4 ring-surface ${activePath === href ? "bg-brand-hover" : "bg-brand"}`}>
              <Icon aria-hidden="true" size={24} />
            </span>
            {label}
          </Link>
        ) : (
          <Link key={href} href={href} aria-current={current(href)} className={`${linkClass} ${tone(href)}`}>
            <Icon aria-hidden="true" size={20} className="shrink-0 sm:size-4" />
            {label}
          </Link>
        ),
      )}
      <MoreNavItem active={activePath === "/more"} className={`${linkClass} ${tone("/more")}`} />
    </nav>
  );
}
