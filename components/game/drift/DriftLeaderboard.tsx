"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { driftLeaderboardAction } from "@/app/play/drift/actions";
import type { Leaderboard } from "@/lib/drift-scores";
import { DRIFT_SCORE_EVENT } from "./events";

const MEDALS = ["🥇", "🥈", "🥉"];

export function DriftLeaderboard({ limit = 10 }: { limit?: number }) {
  const [board, setBoard] = useState<Leaderboard | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () => driftLeaderboardAction(limit).then((b) => { if (alive) setBoard(b); }, () => { if (alive) setBoard(null); });
    load();
    window.addEventListener(DRIFT_SCORE_EVENT, load);
    return () => { alive = false; window.removeEventListener(DRIFT_SCORE_EVENT, load); };
  }, [limit]);

  return (
    <section aria-labelledby="drift-board-heading" className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h2 id="drift-board-heading" className="flex items-center gap-2 text-lg font-bold text-ink"><Trophy aria-hidden="true" size={18} className="text-amber-500" /> Top drifters</h2>
      {board === undefined ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">Loading scores…</p>
      ) : board === null ? (
        <p className="mt-2 text-sm text-ink-muted"><Link href="/login?next=%2Fplay%2Fdrift" className="font-semibold text-brand-ink underline">Sign in</Link> to post your score and see the leaderboard.</p>
      ) : board.top.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">No scores yet. Be the first on the board!</p>
      ) : (
        <>
          <ol className="mt-2 divide-y divide-line-soft">
            {board.top.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={`flex items-center gap-3 py-2 text-sm ${r.me ? "font-bold text-brand-ink" : "text-ink-2"}`}>
                <span className="w-7 shrink-0 text-center tabular-nums">{MEDALS[r.rank - 1] ?? r.rank}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}{r.me && <span className="sr-only"> (you)</span>}</span>
                <span className="font-bold tabular-nums text-ink">{r.score.toLocaleString("en-CA")}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink-muted">
            {board.me ? `You're #${board.me.rank} of ${board.players} with ${board.me.score.toLocaleString("en-CA")}.` : `${board.players} ${board.players === 1 ? "driver" : "drivers"}. Finish a run to join the board.`}
          </p>
        </>
      )}
    </section>
  );
}
