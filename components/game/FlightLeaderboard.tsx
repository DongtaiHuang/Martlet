"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { leaderboardAction } from "@/app/play/actions";
import type { Leaderboard } from "@/lib/flight-scores";

/** Fired by MartletFlight after a score is saved, so the board refreshes. */
export const FLIGHT_SCORE_EVENT = "martlet:flight-score";
const MEDALS = ["🥇", "🥈", "🥉"];

export function FlightLeaderboard({ limit = 10, compact = false }: { limit?: number; compact?: boolean }) {
  const [board, setBoard] = useState<Leaderboard | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () => leaderboardAction(limit).then((b) => { if (alive) setBoard(b); }, () => { if (alive) setBoard(null); });
    load();
    window.addEventListener(FLIGHT_SCORE_EVENT, load);
    return () => { alive = false; window.removeEventListener(FLIGHT_SCORE_EVENT, load); };
  }, [limit]);

  return (
    <section aria-labelledby="flight-board-heading" className={compact ? "mt-4" : "mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5"}>
      <h2 id="flight-board-heading" className={`flex items-center gap-2 font-bold text-ink ${compact ? "text-sm" : "text-lg"}`}>
        <Trophy aria-hidden="true" size={compact ? 15 : 18} className="text-amber-500" /> Leaderboard
      </h2>
      {board === undefined ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">Loading scores…</p>
      ) : board === null ? (
        <p className="mt-2 text-sm text-ink-muted"><Link href="/login?next=%2Fplay" className="font-semibold text-brand-ink underline">Sign in</Link> to post your score and see the leaderboard.</p>
      ) : board.top.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">No scores yet. Be the first on the board!</p>
      ) : (
        <>
          <ol className="mt-2 divide-y divide-line-soft">
            {board.top.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={`flex items-center gap-3 py-2 text-sm ${r.me ? "font-bold text-brand-ink" : "text-ink-2"}`}>
                <span className="w-7 shrink-0 text-center tabular-nums">{MEDALS[r.rank - 1] ?? r.rank}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}{r.me && <span className="sr-only"> (you)</span>}</span>
                <span className="font-bold tabular-nums text-ink">{r.score}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink-muted">
            {board.me ? `You're #${board.me.rank} of ${board.players} with ${board.me.score}.` : `${board.players} ${board.players === 1 ? "player" : "players"}. Finish a run to join the board.`}
          </p>
        </>
      )}
    </section>
  );
}
