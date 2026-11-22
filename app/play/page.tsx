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
      </main>
    </div>
  );
}
