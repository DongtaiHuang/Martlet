"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Trophy, UserRound } from "lucide-react";
import { myAchievements } from "@/app/achievements/actions";
import { ACHIEVEMENTS, type EarnedMap } from "@/lib/achievement-catalog";
import { useEarned } from "@/components/achievements/useEarned";

/**
 * The Profile nav link. On larger screens, hovering or keyboard-focusing it opens a menu
 * with Your profile and Achievements (with a count). Phones have no hover, so
 * tapping goes to the profile, which links to Achievements too.
 */
export function ProfileNavItem({ className, current, name }: { className: string; current?: "page" | "location"; name?: string }) {
  const [account, setAccount] = useState<EarnedMap | null | undefined>(undefined);
  const loading = useRef(false);
  const earned = useEarned(account);

  // Load the user's achievements the first time the menu opens.
  const load = () => {
    if (loading.current) return;
    loading.current = true;
    myAchievements().then(setAccount, () => { loading.current = false; });
  };

  const done = ACHIEVEMENTS.filter((a) => earned[a.id]).length;
  const item = "flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

  return (
    <div className="group relative" onMouseEnter={load} onFocus={load}>
      <Link href="/profile" aria-current={current} className={className}>
        <UserRound aria-hidden="true" size={20} className="shrink-0 sm:size-4" />
        {name ? (
          // Signed in: show the user's name, still announced as their profile.
          // Phones have narrow nav cells, so they get the first name; larger screens get the full name.
          <span title={name} className="max-w-full min-w-0 truncate sm:max-w-40">
            <span className="sm:hidden">Profile</span>
            <span className="hidden sm:inline">{name}</span>
            <span className="sr-only">, your profile</span>
          </span>
        ) : "Profile"}
      </Link>
      {/* pt-2 bridges the gap so the menu doesn't close while the pointer moves onto it. */}
      <div className="absolute top-full right-0 z-50 hidden w-60 pt-2 sm:group-hover:block sm:group-focus-within:block">
        <div className="rounded-2xl border border-line bg-surface p-2 text-ink-soft shadow-xl">
          <Link href="/profile" className={item}><UserRound aria-hidden="true" size={16} className="text-ink-muted" /> Your profile</Link>
          <Link href="/achievements" className={item}>
            <Trophy aria-hidden="true" size={16} className="text-amber-500" /> Achievements
            <span className="ml-auto text-xs font-bold text-ink-subtle">{account === undefined ? "" : `${done} / ${ACHIEVEMENTS.length}`}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
