import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { listTables, SEATS } from "@/lib/blackjack-tables";

export const metadata: Metadata = { title: "Blackjack tables · McGill Martlet" };
export const dynamic = "force-dynamic";

const PHASE: Record<string, string> = { open: "Between hands", betting: "Taking bets", playing: "Hand in play" };

/** Lobby for the shared tables (issue #146, ADR 0035). */
export default async function TablesPage() {
  const tables = await listTables();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-10">
        <Link href="/play/blackjack" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Solo blackjack</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Blackjack tables</h1>
        <p className="mt-1 text-ink-muted">Sit down with up to four other students. Everyone plays the dealer, live, with Martlet points (no cash value).</p>

        {tables === null ? (
          <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
            Tables need an account. <Link href="/login?next=%2Fplay%2Fblackjack%2Ftables" className="font-semibold text-brand-ink underline">Sign in</Link> with your McGill email, or practise on the <Link href="/play/blackjack" className="font-semibold text-brand-ink underline">solo table</Link>.
          </p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {tables.map((t) => (
              <li key={t.id} className="relative flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm hover:border-brand">
                <h2 className="text-lg font-bold">
                  <Link href={`/play/blackjack/tables/${t.id}`} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-focus">{t.name}</Link>
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2"><Users aria-hidden="true" size={15} />{t.players}/{SEATS} seated</p>
                <p className="text-xs text-ink-muted">{PHASE[t.phase]}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-ink">
                  {t.mine ? "Back to your seat" : t.players >= SEATS ? "Watch" : "Join"} <ArrowRight aria-hidden="true" size={15} />
                </p>
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="table-rules" className="mt-8 rounded-2xl border border-line bg-surface p-5 text-sm text-ink-2 shadow-sm">
          <h2 id="table-rules" className="text-lg font-bold text-ink">How tables work</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>The first bet opens a 15-second betting window. It closes early once everyone seated has bet.</li>
            <li>Players act in seat order with 20 seconds each. If time runs out, you stand.</li>
            <li>When everyone’s done, the dealer plays and pays the whole table. Same rules as solo: dealer stands on 17, blackjack pays 3:2.</li>
            <li>You can leave before the deal (your bet comes back) or between hands.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
