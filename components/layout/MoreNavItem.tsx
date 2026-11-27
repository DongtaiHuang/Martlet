"use client";

import Link from "next/link";
import { useId } from "react";
import { BookOpen, CarFront, ChevronDown, Club, Coins, Ellipsis, Gamepad2, Map, MessagesSquare, Newspaper, Palette, Store, TrendingUp, type LucideIcon } from "lucide-react";
import { useMenu } from "./useMenu";

/** Pages without their own tab (issue #119), grouped so they're quick to scan. Your own pages are in the account menu. */
type Item = { href: string; label: string; icon: LucideIcon; tone: string };
const sections: { title: string; items: Item[] }[] = [
  { title: "Community", items: [
    { href: "/board", label: "Campus board", icon: MessagesSquare, tone: "text-brand-ink" },
    { href: "/marketplace", label: "Marketplace", icon: Store, tone: "text-orange-700 dark:text-orange-300" },
    { href: "/creators", label: "Creators", icon: Palette, tone: "text-fuchsia-700 dark:text-fuchsia-300" },
    { href: "/markets", label: "Predictions", icon: TrendingUp, tone: "text-emerald-700 dark:text-emerald-300" },
    { href: "/coin", label: "Martlet Coin", icon: Coins, tone: "text-amber-600 dark:text-amber-300" },
  ] },
  { title: "Play", items: [
    { href: "/play", label: "Martlet Flight", icon: Gamepad2, tone: "text-sky-600 dark:text-sky-300" },
    { href: "/play/skies", label: "Martlet Skies", icon: Map, tone: "text-sky-600 dark:text-sky-300" },
    { href: "/play/drift", label: "Martlet Drift", icon: CarFront, tone: "text-sky-600 dark:text-sky-300" },
    { href: "/play/blackjack", label: "Blackjack", icon: Club, tone: "text-emerald-700 dark:text-emerald-300" },
  ] },
  { title: "Campus", items: [
    { href: "/news", label: "McGill News", icon: Newspaper, tone: "text-ink-muted" },
    { href: "/guide", label: "Student guide", icon: BookOpen, tone: "text-ink-muted" },
  ] },
];
const allItems = sections.flatMap((section) => section.items);

export const MORE_PATHS = ["/board", "/marketplace", "/creators", "/markets", "/coin", "/play", "/news", "/guide"];

/**
 * "More" in the nav: a button that opens a short menu of the remaining pages.
 * Phones: the menu opens upwards from the bottom tab bar. sm+: it drops down from the header.
 * Closes on Escape (focus returns to the button), on a click outside, and after navigating.
 */
export function MoreNavItem({ className, active }: { className: string; active: boolean }) {
  const { open, setOpen, wrapper, button, pathname } = useMenu();
  const menuId = useId();
  const row = "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";
  // The closest match only: /play/blackjack marks Blackjack, not Martlet Flight too.
  const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  const isCurrent = (href: string) => matches(href) && !allItems.some((other) => other.href.length > href.length && matches(other.href));

  return (
    <div ref={wrapper} className="relative">
      <button ref={button} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)} className={`${className} w-full`}>
        <Ellipsis aria-hidden="true" size={20} className="shrink-0 sm:size-4" />
        More
        <ChevronDown aria-hidden="true" size={14} className={`hidden transition-transform sm:block ${open ? "rotate-180" : ""}`} />
        {active && <span className="sr-only">, current section</span>}
      </button>
      {open && (
        <div id={menuId}
          className="absolute right-0 bottom-full z-50 mb-3 max-h-[calc(100dvh-6rem)] w-64 overflow-y-auto rounded-2xl border border-line bg-surface p-2 text-ink-soft shadow-xl sm:top-full sm:right-auto sm:bottom-auto sm:left-0 sm:mt-2 sm:mb-0">
          {sections.map((section, i) => (
            <div key={section.title} className={i ? "mt-1.5 border-t border-line pt-1.5" : ""}>
              <p className="px-3 pt-1 pb-0.5 text-xs font-bold tracking-wide text-ink-muted uppercase">{section.title}</p>
              <ul className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon, tone }) => (
                  <li key={href}>
                    <Link href={href} aria-current={isCurrent(href) ? "page" : undefined} onClick={() => setOpen(false)}
                      className={`${row} ${isCurrent(href) ? "bg-brand-soft text-brand-ink-strong" : ""}`}>
                      <Icon aria-hidden="true" size={16} className={tone} /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
