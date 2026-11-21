import Link from "next/link";
import { MartletNav } from "@/components/layout/MartletNav";
import { MeetupCard } from "@/components/feed/MeetupCard";
import { listMeetups } from "@/lib/meetups";

// Generate the sample start times relative to each request.
export const dynamic = "force-dynamic";

export default async function MeetupsPage() {
  const meetups = await listMeetups();
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-5 py-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-700">Martlet Meet</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Find your people, right now.</h1>
            <p className="mt-2 text-neutral-600">Discover spontaneous McGill meetups near campus.</p>
          </div>
          <Link href="/meetups/new" className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800">+ Create meetup</Link>
        </div>
        <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Demo data only. Developer 3 will connect these cards to Supabase; do not present these as real people or live events.
        </div>
        <section aria-label="Upcoming meetups" className="mt-7 grid gap-4 md:grid-cols-2">
          {meetups.map(m => <MeetupCard key={m.id} meetup={m} />)}
        </section>
      </main>
    </div>
  );
}
