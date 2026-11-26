import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { DriftLoader } from "@/components/game/drift/DriftLoader";
import { DriftLeaderboard } from "@/components/game/drift/DriftLeaderboard";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Martlet Drift · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function DriftPage() {
  const signedIn = getDataMode() === "live" && Boolean(await getCurrentUser().catch(() => null));
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-10">
        <Link href="/play" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Games</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Martlet Drift</h1>
        <p className="mt-1 mb-5 text-ink-muted">90 seconds on real campus streets (Sherbrooke, University, Pine and McTavish), as sideways as you dare. Handbrake into a corner, keep the throttle on and steer to hold the slide.</p>
        <DriftLoader signedIn={signedIn} />
        <section aria-labelledby="how-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm text-ink-2 shadow-sm">
          <h2 id="how-heading" className="text-lg font-bold text-ink">Scoring</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>You score while the car slides between 12° and 100° above about 30 km/h. Wider angles and higher speed score more.</li>
            <li>Keep drifting to build a combo: ×2 after 2.5 seconds, up to ×5. A short straight between drifts keeps it going.</li>
            <li>Points bank when the combo ends. Leaving the track or spinning out loses the combo in progress.</li>
            <li>Controls: W/↑ gas, S/↓ brake, A D/← → steer, Space handbrake, P pause. On a phone, use the on-screen buttons.</li>
          </ul>
        </section>
        <DriftLeaderboard limit={10} />
      </main>
    </div>
  );
}
