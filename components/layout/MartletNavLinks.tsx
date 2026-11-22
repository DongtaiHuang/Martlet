"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, Landmark, Plus, Sprout, UserRound } from "lucide-react";

const links = [
  { href: "/meetups", label: "Feed", icon: House },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/landmarks", label: "Landmarks", icon: Landmark },
  { href: "/progress", label: "Progress", icon: Sprout },
  { href: "/meetups/new", label: "Create", icon: Plus },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function MartletNavLinks() {
  const pathname = usePathname();
  const activePath = pathname.startsWith("/meetups/") && pathname !== "/meetups/new" ? "/meetups"
    : pathname.startsWith("/landmarks/") ? "/landmarks" : pathname === "/avatar" ? "/profile" : pathname;

  return (
    <nav aria-label="Martlet navigation" className="grid grid-cols-6 gap-0.5 pb-2 sm:flex sm:pb-0">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={activePath === href ? (pathname === href ? "page" : "location") : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10.5px] max-[359px]:text-[9.5px] max-[359px]:tracking-tighter font-semibold sm:flex-row focus-visible:outline-2 focus-visible:outline-red-700 sm:gap-2 sm:px-3 sm:text-sm ${activePath === href ? "bg-red-50 text-red-900" : "text-stone-600 hover:bg-stone-100"}`}>
          <Icon aria-hidden="true" size={16} className="shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
