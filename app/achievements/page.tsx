import type { Metadata } from "next";
import Link from "next/link";
import { MartletNav } from "@/components/layout/MartletNav";
import { AchievementGrid } from "@/components/achievements/AchievementGrid";
import { AchievementsNotSetUpError, listMyAchievements } from "@/lib/achievements";
import type { EarnedMap } from "@/lib/achievement-catalog";
import { getDataMode } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Achievements · McGill Martlet" };
export const dynamic = "force-dynamic";

type State = { kind: "account"; earned: EarnedMap } | { kind: "guest" } | { kind: "not-set-up" } | { kind: "error" };

async function load(): Promise<State> {
  try {
    const earned = await listMyAchievements();
    return earned ? { kind: "account", earned } : { kind: "guest" };
  } catch (error) {
    if (error instanceof AchievementsNotSetUpError) {
      console.warn(error.message);
      return { kind: "not-set-up" };
    }
    console.error("Failed to load achievements", error);
    return { kind: "error" };
  }
}

export default async function AchievementsPage() {
  const state = await load();
  const mock = getDataMode() === "mock";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Achievements</h1>
        <p className="mt-2 text-ink-muted">Some are obvious. Most are hidden. The martlets know things.</p>

        {state.kind === "guest" && (
          <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn-ink">
            {mock
              ? "Demo mode: achievements are saved in this browser only."
              : <>You’re signed out, so achievements are saved in this browser only. <Link href="/login?next=/achievements" className="font-bold underline">Sign in</Link> to keep new ones on your profile.</>}
          </p>
        )}

        {state.kind === "not-set-up" && (
          <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn-ink">
            Achievements aren’t set up in the database yet, so for now they’re saved in this browser only.
          </p>
        )}

        <div className="mt-6">
          {state.kind === "error" ? (
            <p role="alert" className="text-sm text-ink-muted">Couldn’t load your achievements. Refresh the page to try again.</p>
          ) : (
            <AchievementGrid earned={state.kind === "account" ? state.earned : null} />
          )}
        </div>
      </main>
    </div>
  );
}
