"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, Landmark, Plus, Sprout } from "lucide-react";
import { ProfileNavItem } from "./ProfileNavItem";

const links = [
  { href: "/meetups", label: "Feed", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/landmarks", label: "Landmarks", icon: Landmark },
  { href: "/progress", label: "Progress", icon: Sprout },
  { href: "/meetups/new", label: "Create", icon: Plus },
];
const linkClass = "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10.5px] max-[359px]:text-[9.5px] max-[359px]:tracking-tighter font-semibold sm:flex-row focus-visible:outline-2 focus-visible:outline-focus sm:gap-2 sm:px-3 sm:text-sm";

export function MartletNavLinks() {
  const pathname = usePathname();
  const activePath = pathname.startsWith("/meetups/") && pathname !== "/meetups/new" ? "/meetups"
    : pathname.startsWith("/landmarks/") ? "/landmarks" : pathname === "/avatar" || pathname === "/achievements" ? "/profile" : pathname;
  const current = (href: string) => (activePath === href ? (pathname === href ? "page" : "location") : undefined);
  const tone = (href: string) => (activePath === href ? "bg-brand-soft text-brand-ink-strong" : "text-ink-muted hover:bg-surface-muted");

  return (
    <nav aria-label="Martlet navigation" className="grid grid-cols-6 gap-0.5 pb-2 sm:flex sm:pb-0">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={current(href)} className={`${linkClass} ${tone(href)}`}>
          <Icon aria-hidden="true" size={16} className="shrink-0" />
          {label}
        </Link>
      ))}
      {/* Profile, with a hover/focus menu for Achievements on larger screens. */}
      <ProfileNavItem current={current("/profile")} className={`${linkClass} ${tone("/profile")}`} />
    </nav>
  );
}
