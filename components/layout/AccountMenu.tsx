"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ChevronDown, LogOut, Monitor, Moon, Palette, ShieldCheck, Sprout, Sun, Trophy, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { myAchievements } from "@/app/achievements/actions";
import { ACHIEVEMENTS, type EarnedMap } from "@/lib/achievement-catalog";
import { useEarned } from "@/components/achievements/useEarned";
import { useModePreference } from "@/lib/useColorMode";
import type { ModePreference } from "@/lib/theme";
import { useMenu } from "./useMenu";

/** Pages that belong to you: the account button is highlighted on them. */
export const ACCOUNT_PATHS = ["/profile", "/avatar", "/progress", "/achievements", "/moderation"];

const MODES: { value: ModePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * The signed-in student's menu, top right on every screen size: their pages, light/dark, and
 * Sign out at the bottom where people look for it. Opens on click or tap (no hover menus).
 */
export function AccountMenu({ name, moderator = false }: { name: string; moderator?: boolean }) {
  const { open, setOpen, wrapper, button, pathname } = useMenu();
  const menuId = useId();
  const [pref, setPref] = useModePreference();
  const [account, setAccount] = useState<EarnedMap | null | undefined>(undefined);
  const loading = useRef(false);
  const earned = useEarned(account);
  const done = ACHIEVEMENTS.filter((a) => earned[a.id]).length;
  const active = ACCOUNT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const initial = (name.trim()[0] ?? "M").toUpperCase();

  const toggle = () => {
    if (!open && !loading.current) {
      loading.current = true;
      myAchievements().then(setAccount, () => { loading.current = false; });
    }
    setOpen(!open);
  };

  const row = "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";
  const here = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);

  return (
    <div ref={wrapper} className="relative">
      <button ref={button} type="button" aria-expanded={open} aria-controls={menuId} onClick={toggle}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full p-1 pr-1.5 text-sm font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus lg:pr-2.5 ${active || open ? "bg-brand-soft text-brand-ink-strong" : "text-ink-soft"}`}>
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-brand text-base font-extrabold text-on-brand">{initial}</span>
        <span className="hidden max-w-32 truncate lg:inline">{name}</span>
        <ChevronDown aria-hidden="true" size={16} className={`hidden transition-transform lg:block ${open ? "rotate-180" : ""}`} />
        <span className="sr-only">Account menu for {name}</span>
      </button>
      {open && (
        <div id={menuId} className="absolute top-full right-0 z-50 mt-2 max-h-[calc(100dvh-5.5rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-2 text-ink-soft shadow-xl">
          <div className="flex items-center gap-3 px-3 pt-1 pb-2.5">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-lg font-extrabold text-on-brand">{initial}</span>
            <span className="min-w-0">
              <span className="block truncate font-bold text-ink">{name}</span>
              <span className="block text-xs text-ink-muted">Signed in</span>
            </span>
          </div>
          <ul className="space-y-0.5 border-t border-line pt-1.5">
            <li><Link href="/profile" aria-current={here("/profile")} className={row}><UserRound aria-hidden="true" size={16} className="text-ink-muted" /> Your profile</Link></li>
            <li><Link href="/progress" aria-current={here("/progress")} className={row}><Sprout aria-hidden="true" size={16} className="text-ok-ink" /> Progress</Link></li>
            <li>
              <Link href="/achievements" aria-current={here("/achievements")} className={row}>
                <Trophy aria-hidden="true" size={16} className="text-amber-500" /> Achievements
                <span className="ml-auto text-xs font-bold text-ink-subtle">{account === undefined ? "" : `${done} / ${ACHIEVEMENTS.length}`}</span>
              </Link>
            </li>
            {moderator && <li><Link href="/moderation" aria-current={here("/moderation")} className={row}><ShieldCheck aria-hidden="true" size={16} className="text-ok-ink" /> Moderation</Link></li>}
          </ul>
          <div className="mt-1.5 border-t border-line px-1 pt-2.5 pb-1">
            <p id={`${menuId}-mode`} className="px-2 text-xs font-bold tracking-wide text-ink-muted uppercase">Appearance</p>
            <div role="radiogroup" aria-labelledby={`${menuId}-mode`} className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-surface-muted p-1">
              {MODES.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" role="radio" aria-checked={pref === value} onClick={() => setPref(value)}
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-focus ${pref === value ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
                  <Icon aria-hidden="true" size={16} />{label}
                </button>
              ))}
            </div>
            <Link href="/profile#appearance" className={`${row} mt-1`}><Palette aria-hidden="true" size={16} className="text-ink-muted" /> Themes and colours</Link>
          </div>
          <form action={signOut} className="mt-1 border-t border-line pt-1.5">
            <button type="submit" className={`${row} w-full text-brand-ink`}>
              <LogOut aria-hidden="true" size={16} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
