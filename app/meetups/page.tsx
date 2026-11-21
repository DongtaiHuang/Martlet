import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Compass, FlaskConical, LogIn, Plus } from "lucide-react";
import { FeedUnavailable } from "@/components/feed/FeedUnavailable";
import { MeetupFeed } from "@/components/feed/MeetupFeed";
import campusBanner from "@/components/feed/campus-banner.webp";
import { MartletNav } from "@/components/layout/MartletNav";
import { listMeetups } from "@/lib/meetups";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

async function loadUpcomingMeetups() {
  try {
    const meetups = await listMeetups();
    const now = Date.now();
    return meetups
      .filter((meetup) => meetup.status === "open" && Date.parse(meetup.starts_at) > now)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  } catch (error) {
    console.error("Failed to load the meetup feed", error);
    return null;
  }
}

async function UpcomingMeetups() {
  const live = getDataMode() === "live";
  const viewer = live ? await getCurrentUser().catch(() => null) : null;

  // Live mode: meetups are only readable when signed in (RLS), so don't show an empty feed.
  if (live && !viewer) {
    return (
      <div className="mt-5 rounded-2xl border border-stone-200 bg-white px-5 py-8 text-center">
        <LogIn aria-hidden="true" className="mx-auto mb-3 text-red-800" />
        <h3 className="text-lg font-bold text-stone-900">Sign in to see meetups</h3>
        <p className="mt-1 text-sm text-stone-600">Meetups are visible to signed-in McGill students.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/login?next=/meetups" className="inline-flex min-h-11 items-center rounded-xl bg-red-800 px-4 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">Sign in</Link>
          <Link href="/signup" className="inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-4 text-sm font-bold text-stone-800 hover:border-red-700 focus-visible:outline-2 focus-visible:outline-red-700">Create account</Link>
        </div>
      </div>
    );
  }

  const upcoming = await loadUpcomingMeetups();
  if (!upcoming) return <FeedUnavailable />;

  return (
    <>
      {!live && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <FlaskConical aria-hidden="true" size={15} />
          <span><strong>Preview:</strong> sample meetups, not real events. Joining and liking need Supabase. See <code>docs/SUPABASE_SETUP.md</code>.</span>
        </p>
      )}
      <MeetupFeed meetups={upcoming} viewerId={viewer?.id ?? null} />
    </>
  );
}

function FeedLoading() {
  return (
    <div className="mt-5">
      <p role="status" className="mb-4 text-sm text-stone-600">Loading meetups…</p>
      <div aria-hidden="true" className="grid gap-4 motion-safe:animate-pulse md:grid-cols-2">
        {[1, 2].map((card) => (
          <div key={card} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="h-6 w-20 rounded-full bg-stone-100" />
            <div className="h-5 w-2/3 rounded bg-stone-200" />
            <div className="h-4 w-1/2 rounded bg-stone-100" />
            <div className="h-4 w-4/5 rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MeetupsPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-12 sm:px-8 sm:pt-8">
        <section aria-labelledby="campus-heading" className="relative isolate overflow-hidden rounded-3xl bg-stone-900 px-5 py-9 text-white sm:px-10 sm:py-14">
          <Image src={campusBanner} alt="" fill preload sizes="(min-width: 1152px) 1088px, 95vw" className="-z-20 object-cover object-[65%_55%]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-stone-950/95 via-stone-950/80 to-stone-950/25 sm:via-stone-950/55" />
          <h1 id="campus-heading" className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">Meet up at McGill</h1>
          <p className="mt-3 max-w-sm text-base leading-6 text-stone-100 sm:text-lg">Find a study group, grab coffee, or make plans with people on campus.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/meetups/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Plus aria-hidden="true" size={18} /> Create meetup</Link>
            <Link href="/explore" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/50 bg-stone-950/55 px-4 text-sm font-bold text-white hover:bg-stone-950/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><Compass aria-hidden="true" size={18} /> Explore map</Link>
          </div>
        </section>
        <section aria-labelledby="upcoming-heading" className="mt-8 sm:mt-10">
          <h2 id="upcoming-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Upcoming meetups</h2>
          <Suspense fallback={<FeedLoading />}>
            <UpcomingMeetups />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
