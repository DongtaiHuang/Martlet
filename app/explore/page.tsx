import Link from "next/link";
import { MartletNav } from "@/components/layout/MartletNav";
import { CampusMap } from "@/components/map/CampusMap";
import { listLandmarks } from "@/lib/landmarks";
import { listMeetups } from "@/lib/meetups";

// Generate the sample start times relative to each request.
export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ meetup?: string | string[] }>;
}) {
  const [meetups, landmarks, { meetup }] = await Promise.all([listMeetups(), listLandmarks(), searchParams]);
  // ?meetup=<id> (linked from a meetup's location) opens the map on that meetup.
  const focusId = typeof meetup === "string" ? meetup : undefined;

  return <div className="min-h-screen bg-canvas text-ink-soft"><MartletNav />
    <main className="mx-auto max-w-5xl px-5 py-9">
      <h1 className="text-3xl font-bold">Explore Montréal</h1>
      <p className="mt-2 mb-5 text-ink-muted">Find spontaneous meetups and landmarks on a map. Show either or both, and filter meetups by category.</p>
      <CampusMap meetups={meetups} focusId={focusId} landmarks={landmarks} />
      <p className="mt-3 text-xs text-ink-subtle">Tap a marker for details, or browse meetups without a map pin below.</p>
      {landmarks.length > 0 && (
        <p className="mt-1 text-xs text-ink-subtle">
          Tower pins are <Link href="/landmarks" className="font-semibold text-brand-ink underline">landmarks</Link> to unlock with a photo; they grow as more photos are shared. Some are off campus; zoom out to find them.
        </p>
      )}
    </main></div>;
}
