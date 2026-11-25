import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { BlackjackTable } from "@/components/blackjack/BlackjackTable";
import { getBlackjackTable, isBlackjackPreview } from "@/lib/blackjack";

export const metadata: Metadata = { title: "Blackjack · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function BlackjackPage() {
  const table = await getBlackjackTable();
  const practice = table === null;
  const preview = isBlackjackPreview();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-10">
        <Link href="/play" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Martlet Flight</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Blackjack</h1>
        <p className="mt-1 mb-5 text-ink-muted">
          Beat the dealer to 21 with Martlet points. It’s a game: points have no cash value, can’t be bought or cashed out, and top back up to 1000 each week.
        </p>

        {practice && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <span>
              {preview
                ? <><strong>Practice table:</strong> preview mode has no accounts, so chips aren’t saved.</>
                : <><strong>Practice table:</strong> chips aren’t saved. <Link href="/login?next=%2Fplay%2Fblackjack" className="font-semibold underline">Sign in</Link> to play with your Martlet points.</>}
            </span>
          </p>
        )}

        <BlackjackTable initial={table?.hand ?? null} balance={table?.balance ?? 1000} practice={practice} />

        {table && table.today.hands > 0 && (
          <p className="mt-3 text-center text-sm text-ink-muted">
            Today: {table.today.hands} {table.today.hands === 1 ? "hand" : "hands"}, {table.today.net >= 0 ? "+" : "−"}{Math.abs(table.today.net)} points. Up to 100 hands a day.
          </p>
        )}

        <section aria-labelledby="rules-heading" className="mt-8 rounded-2xl border border-line bg-surface p-5 text-sm text-ink-2 shadow-sm">
          <h2 id="rules-heading" className="text-lg font-bold text-ink">Rules</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Get closer to 21 than the dealer without going over. Face cards are 10, aces are 1 or 11.</li>
            <li><strong>Hit</strong> takes a card, <strong>Stand</strong> ends your turn, <strong>Double</strong> doubles your bet for exactly one more card.</li>
            <li>The dealer draws to 17 and stands on every 17. A win pays 1:1, blackjack (an ace and a 10-card) pays 3:2.</li>
            <li>One fresh deck per hand, shuffled on the server. Bets are 1–100 points.</li>
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            The house has a small edge, so over time you’ll lose points. Blackjack doesn’t affect the forecasters leaderboard on <Link href="/markets" className="underline">Predictions</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
