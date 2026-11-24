"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, Landmark, Plus, Sprout } from "lucide-react";
import { MORE_PATHS, MoreNavItem } from "./MoreNavItem";
import { ProfileNavItem } from "./ProfileNavItem";

const links = [
  { href: "/meetups", label: "Feed", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/landmarks", label: "Landmarks", icon: Landmark },
  // Phones have no room for a sixth tab: Progress moves into More there.
  { href: "/progress", label: "Progress", icon: Sprout, phoneHidden: true },
  { href: "/meetups/new", label: "Create", icon: Plus },
];
const linkClass = "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[11px] max-[359px]:text-[10px] max-[359px]:tracking-tighter font-semibold sm:flex-row focus-visible:outline-2 focus-visible:outline-focus sm:gap-2 sm:px-3 sm:text-sm";

export function MartletNavLinks({ profileName, moderator = false }: { profileName?: string; moderator?: boolean }) {
  const pathname = usePathname();
  const activePath = pathname.startsWith("/meetups/") && pathname !== "/meetups/new" ? "/meetups"
    : pathname.startsWith("/landmarks/") ? "/landmarks" : pathname === "/avatar" ? "/profile"
    : MORE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ? "/more" : pathname;
  const current = (href: string) => (activePath === href ? (pathname === href ? "page" : "location") : undefined);
  const tone = (href: string) => (activePath === href ? "bg-brand-soft text-brand-ink-strong" : "text-ink-muted hover:bg-surface-muted");

  return (
    // Phones: a bottom tab bar (thumb reach, frees the top of the screen). sm+: inline in the header.
    <nav aria-label="Martlet navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 gap-0.5 border-t border-line bg-surface/95 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.25)] backdrop-blur-md sm:static sm:flex sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
      {links.map(({ href, label, icon: Icon, ...rest }) => (
        <Link key={href} href={href} aria-current={current(href)} className={`${linkClass} ${tone(href)}${"phoneHidden" in rest ? " max-sm:hidden" : ""}`}>
          <Icon aria-hidden="true" size={20} className="shrink-0 sm:size-4" />
          {label}
        </Link>
      ))}
      <MoreNavItem moderator={moderator} active={activePath === "/more"} className={`${linkClass} ${tone("/more")}`} />
      {/* Profile (labelled with the user's name when signed in), with a hover/focus menu for Achievements on larger screens. */}
      <ProfileNavItem name={profileName} moderator={moderator} current={current("/profile")} className={`${linkClass} ${tone("/profile")}`} />
    </nav>
  );
}
