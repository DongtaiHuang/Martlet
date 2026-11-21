import { MartletNav } from "@/components/layout/MartletNav";
import { CampusMap } from "@/components/map/CampusMap";
import { listMeetups } from "@/lib/meetups";

// Generate the sample start times relative to each request.
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const meetups = await listMeetups();
  return <div className="min-h-screen bg-neutral-50 text-neutral-900"><MartletNav />
    <main className="mx-auto max-w-5xl px-5 py-9">
      <h1 className="text-3xl font-bold">Explore campus</h1>
      <p className="mt-2 mb-5 text-neutral-600">Find spontaneous meetups on a map. Demo records for now.</p>
      <CampusMap meetups={meetups} />
      <p className="mt-3 text-xs text-neutral-500">MapLibre demo tiles are for development only. Configure a production map-style URL before launch.</p>
    </main></div>;
}
