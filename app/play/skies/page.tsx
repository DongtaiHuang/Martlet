import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { SkiesLoader } from "@/components/game/skies/SkiesLoader";
import type { SkiesLandmark, SkiesMeetup } from "@/components/game/skies/MartletSkies";
import { BOUNDS } from "@/components/game/skies/skies-math";
import { listLandmarks } from "@/lib/landmarks";
import { listMeetups } from "@/lib/meetups";

export const metadata: Metadata = { title: "Martlet Skies · McGill Martlet" };
export const dynamic = "force-dynamic";

const HOUR = 3_600_000;

/** Upcoming meetups at a mapped spot (custom locations have no coordinates, ADR 0022). */
function upcomingSpots(meetups: Awaited<ReturnType<typeof listMeetups>>): SkiesMeetup[] {
  const cutoff = Date.now() - 2 * HOUR;
  return meetups
    .filter((m) => m.latitude !== null && m.longitude !== null && Date.parse(m.starts_at) > cutoff)
    .map((m) => ({ id: m.id, title: m.title, location_name: m.location_name, latitude: m.latitude as number, longitude: m.longitude as number, starts_at: m.starts_at }));
}

export default async function SkiesPage() {
  // Both lists are optional: signed out (or offline) you can still fly over campus.
  const [landmarks, meetups] = await Promise.all([
    listLandmarks().catch(() => []),
    listMeetups().catch(() => []),
  ]);
  // Only landmarks inside the play area can be reached (and counted for "Bird's-eye view").
  const inside = (l: { latitude: number; longitude: number }) =>
    l.longitude >= BOUNDS.west && l.longitude <= BOUNDS.east && l.latitude >= BOUNDS.south && l.latitude <= BOUNDS.north;
  const towers: SkiesLandmark[] = landmarks.filter(inside).map(({ id, name, latitude, longitude, radius_m, unlock_count, unlocked }) =>
    ({ id, name, latitude, longitude, radius_m, unlock_count, unlocked }));
  const spots = upcomingSpots(meetups);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-10">
        <Link href="/play" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Games</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Martlet Skies</h1>
        <p className="mt-1 mb-5 text-ink-muted">Fly your martlet over the real campus. Visit every landmark tower and spot meetups from the air.</p>
        <SkiesLoader landmarks={towers} meetups={spots} />
        <section aria-labelledby="how-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm text-ink-2 shadow-sm">
          <h2 id="how-heading" className="text-lg font-bold text-ink">How to fly</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>←/→ or A/D steer, ↑/↓ or W/S climb and dive, Shift or Space boosts, P pauses. On a phone, use the on-screen buttons.</li>
            <li>Fly into a landmark tower to visit it; the arrow at the top points to the nearest one you haven’t visited. Visit them all for an achievement.</li>
            <li>Fly over a meetup bubble to see what’s happening there.</li>
            <li>Visiting from the air doesn’t unlock a landmark: that still takes the photo challenge on campus.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
