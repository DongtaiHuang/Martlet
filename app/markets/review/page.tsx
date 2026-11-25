import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { formatWhen } from "@/components/markets/format";
import { isMarketModerator, listPendingMarkets } from "@/lib/markets";
import { reviewAction } from "../actions";

export const metadata: Metadata = { title: "Review markets · McGill Martlet" };
export const dynamic = "force-dynamic";

/** Moderators approve or reject proposed markets (ADR 0033). */
export default async function ReviewMarketsPage() {
  const moderator = await isMarketModerator();
  const pending = moderator ? await listPendingMarkets() : [];
  const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/markets" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> All predictions</Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Review markets</h1>
        {!moderator ? (
          <p className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">Only moderators can review markets.</p>
        ) : (
          <>
            <p className="mt-2 text-ink-muted">Approve clear yes/no questions about campus events with a checkable source. Reject anything about individual people, anything harmful, or anything that can’t be verified.</p>
            {pending.length === 0 ? (
              <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-ink-muted">Nothing waiting for review.</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {pending.map((m) => (
                  <li key={m.id} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <h2 className="text-lg font-bold [overflow-wrap:anywhere]">{m.question}</h2>
                    <p className="mt-1 text-xs text-ink-muted">Closes {formatWhen(m.closes_at)}</p>
                    <p className="mt-3 whitespace-pre-line text-sm text-ink-2 [overflow-wrap:anywhere]">{m.details}</p>
                    <form action={reviewAction} className="mt-4 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" name="decision" value="approve" className={`${btn} bg-brand text-on-brand hover:bg-brand-hover`}><Check aria-hidden="true" size={16} /> Approve</button>
                      <button type="submit" name="decision" value="reject" className={`${btn} border border-line-strong bg-surface text-ink-2 hover:border-brand`}><X aria-hidden="true" size={16} /> Reject</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
