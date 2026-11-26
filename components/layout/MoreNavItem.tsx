"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, CarFront, Club, Coins, Ellipsis, Gamepad2, MessagesSquare, Newspaper, ShieldCheck, Sprout, Store, TrendingUp, Trophy } from "lucide-react";

/** Pages without their own tab (issue #119). Progress has a tab on larger screens, so it only appears here on phones. */
const items = [
  { href: "/progress", label: "Progress", icon: Sprout, tone: "text-ok-ink", phoneOnly: true },
  { href: "/board", label: "Campus board", icon: MessagesSquare, tone: "text-brand-ink" },
  { href: "/marketplace", label: "Marketplace", icon: Store, tone: "text-orange-700 dark:text-orange-300" },
  { href: "/markets", label: "Predictions", icon: TrendingUp, tone: "text-emerald-700 dark:text-emerald-300" },
  { href: "/coin", label: "Martlet Coin", icon: Coins, tone: "text-amber-600 dark:text-amber-300" },
  { href: "/achievements", label: "Achievements", icon: Trophy, tone: "text-amber-500" },
  { href: "/play", label: "Martlet Flight", icon: Gamepad2, tone: "text-sky-600 dark:text-sky-300" },
  { href: "/play/drift", label: "Martlet Drift", icon: CarFront, tone: "text-sky-600 dark:text-sky-300" },
  { href: "/play/blackjack", label: "Blackjack", icon: Club, tone: "text-emerald-700 dark:text-emerald-300" },
  { href: "/news", label: "McGill News", icon: Newspaper, tone: "text-ink-muted" },
  { href: "/guide", label: "Student guide", icon: BookOpen, tone: "text-ink-muted" },
] as const;

export const MORE_PATHS = ["/board", "/marketplace", "/markets", "/coin", "/achievements", "/play", "/news", "/guide", "/moderation"];

/**
 * "More" in the nav: a button that opens a short menu of the remaining pages.
 * Phones: the menu opens upwards from the bottom tab bar. sm+: it drops down from the header.
 * Closes on Escape (focus returns to the button), on a click outside, and after navigating.
 */
export function MoreNavItem({ className, active, moderator = false }: { className: string; active: boolean; moderator?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Close after a route change (a link was followed).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const links = moderator ? [...items, { href: "/moderation", label: "Moderation", icon: ShieldCheck, tone: "text-ok-ink" }] : items;
  const row = "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={`${className} w-full`}
      >
        <Ellipsis aria-hidden="true" size={20} className="shrink-0 sm:size-4" />
        More
        {active && <span className="sr-only">, current section</span>}
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 bottom-full z-50 mb-3 w-60 rounded-2xl border border-line bg-surface p-2 text-ink-soft shadow-xl sm:top-full sm:bottom-auto sm:mt-2 sm:mb-0"
        >
          <ul className="space-y-0.5">
            {links.map(({ href, label, icon: Icon, tone, ...rest }) => {
              // The closest match only: /play/blackjack marks Blackjack, not Martlet Flight too.
              const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
              const current = matches(href) && !links.some((other) => other.href.length > href.length && matches(other.href));
              return (
                <li key={href} className={"phoneOnly" in rest ? "sm:hidden" : undefined}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`${row} ${current ? "bg-brand-soft text-brand-ink-strong" : ""}`}
                  >
                    <Icon aria-hidden="true" size={16} className={tone} /> {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
