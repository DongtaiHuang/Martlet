import { MartletNav } from "@/components/layout/MartletNav";
import { CampusMap } from "@/components/map/CampusMap";
import { listMeetups } from "@/lib/meetups";

// Generate the sample start times relative to each request.
export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ meetup?: string | string[] }>;
}) {
  const [meetups, { meetup }] = await Promise.all([listMeetups(), searchParams]);
  // ?meetup=<id> (linked from a meetup's location) opens the map on that meetup.
  const focusId = typeof meetup === "string" ? meetup : undefined;

  return <div className="min-h-screen bg-neutral-50 text-neutral-900"><MartletNav />
    <main className="mx-auto max-w-5xl px-5 py-9">
      <h1 className="text-3xl font-bold">Explore campus</h1>
      <p className="mt-2 mb-5 text-neutral-600">Find spontaneous meetups on a map. Filter by category.</p>
      <CampusMap meetups={meetups} focusId={focusId} />
      <p className="mt-3 text-xs text-neutral-500">Tap a marker for details. Locations are approved campus landmarks only.</p>
    </main></div>;
}
