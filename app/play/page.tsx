import Link from "next/link";
import { CarFront, Club, Map } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { MartletFlightLoader } from "@/components/game/MartletFlightLoader";
import { FlightLeaderboard } from "@/components/game/FlightLeaderboard";

export const metadata = { title: "Martlet Flight · McGill Martlet" };

export default function PlayPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-10">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Martlet Flight</h1>
        <p className="mt-1 mb-5 text-ink-muted">Fly your martlet between the campus columns. Grab gold landmark pins for +2. How far can you get?</p>
        <MartletFlightLoader />
        <p className="mt-4 text-center text-xs text-ink-subtle">Space / ↑ / tap to flap · P to pause · signed-in scores go on the leaderboard</p>
        <FlightLeaderboard limit={10} />
        <Link href="/play/skies" className="mt-6 flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface p-4 font-semibold text-ink shadow-sm hover:border-brand focus-visible:outline-2 focus-visible:outline-focus">
          <Map aria-hidden="true" size={18} className="text-brand-ink" /> Martlet Skies <span className="ml-auto text-sm text-ink-muted">Fly over the real campus</span>
        </Link>
        <Link href="/play/drift" className="mt-3 flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface p-4 font-semibold text-ink shadow-sm hover:border-brand focus-visible:outline-2 focus-visible:outline-focus">
          <CarFront aria-hidden="true" size={18} className="text-sky-600 dark:text-sky-300" /> Martlet Drift <span className="ml-auto text-sm text-ink-muted">90-second drift run</span>
        </Link>
        <Link href="/play/blackjack" className="mt-3 flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface p-4 font-semibold text-ink shadow-sm hover:border-brand focus-visible:outline-2 focus-visible:outline-focus">
          <Club aria-hidden="true" size={18} className="text-emerald-700 dark:text-emerald-300" /> Try your luck at blackjack <span className="ml-auto text-sm text-ink-muted">Martlet points</span>
        </Link>
      </main>
    </div>
  );
}
