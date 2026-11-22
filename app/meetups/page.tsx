import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, FlaskConical, LogIn } from "lucide-react";
import type { LandmarkSummary } from "@/types/landmark";
import { FeedUnavailable } from "@/components/feed/FeedUnavailable";
import { FeedViewToggle, type FeedView } from "@/components/feed/FeedViewToggle";
import { MeetupFeed } from "@/components/feed/MeetupFeed";
import { HeroCarousel } from "@/components/feed/HeroCarousel";
import { LandmarkPreviewCard } from "@/components/landmarks/LandmarkPreviewCard";
import { MartletNav } from "@/components/layout/MartletNav";
import { listLandmarks } from "@/lib/landmarks";
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

function SignInPrompt({ subject, next }: { subject: "meetups" | "landmarks"; next: string }) {
  const title = subject === "meetups" ? "Meetups" : "Landmarks";
  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface px-5 py-8 text-center">
      <LogIn aria-hidden="true" className="mx-auto mb-3 text-brand-ink" />
      <h3 className="text-lg font-bold text-ink-soft">Sign in to see {subject}</h3>
      <p className="mt-1 text-sm text-ink-muted">{title} are visible to signed-in McGill students.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Sign in</Link>
        <Link href="/signup" className="inline-flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-bold text-ink-soft hover:border-brand focus-visible:outline-2 focus-visible:outline-focus">Create account</Link>
      </div>
    </div>
  );
}

async function FeedLandmarks() {
  const live = getDataMode() === "live";
  const viewer = live ? await getCurrentUser().catch(() => null) : null;
  if (live && !viewer) return <SignInPrompt subject="landmarks" next="/meetups?view=landmarks" />;

  let landmarks: LandmarkSummary[];
  try {
    landmarks = await listLandmarks();
  } catch (error) {
    console.error("Failed to load landmarks for the feed", error);
    return <FeedUnavailable subject="landmarks" />;
  }
  const unlocked = landmarks.filter((l) => l.unlocked).length;

  return (
    <>
      <div className="mt-4 mb-5 flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm font-medium text-ink-muted">
          {landmarks.length} {landmarks.length === 1 ? "landmark" : "landmarks"} · {unlocked} unlocked
        </p>
        <Link href="/landmarks" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">
          All landmarks <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>
      {landmarks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {landmarks.map((landmark) => <LandmarkPreviewCard key={landmark.id} landmark={landmark} />)}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-10 text-center text-ink-muted">No landmarks yet.</p>
      )}
    </>
  );
}

async function UpcomingMeetups() {
  const live = getDataMode() === "live";
  const viewer = live ? await getCurrentUser().catch(() => null) : null;

  // Live mode: meetups are only readable when signed in (RLS), so don't show an empty feed.
  if (live && !viewer) return <SignInPrompt subject="meetups" next="/meetups" />;

  const upcoming = await loadUpcomingMeetups();
  if (!upcoming) return <FeedUnavailable />;

  return (
    <>
      {!live && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn-ink">
          <FlaskConical aria-hidden="true" size={15} />
          <span><strong>Preview:</strong> sample meetups, not real events. Joining and liking need Supabase. See <code>docs/SUPABASE_SETUP.md</code>.</span>
        </p>
      )}
      <MeetupFeed meetups={upcoming} viewerId={viewer?.id ?? null} />
    </>
  );
}

function FeedLoading({ subject }: { subject: FeedView }) {
  return (
    <div className="mt-5">
      <p role="status" className="mb-4 text-sm text-ink-muted">Loading {subject}…</p>
      <div aria-hidden="true" className="grid gap-4 motion-safe:animate-pulse md:grid-cols-2">
        {[1, 2].map((card) => (
          <div key={card} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
            <div className="h-6 w-20 rounded-full bg-surface-muted" />
            <div className="h-5 w-2/3 rounded bg-line" />
            <div className="h-4 w-1/2 rounded bg-surface-muted" />
            <div className="h-4 w-4/5 rounded bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MeetupsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const view: FeedView = (await searchParams).view === "landmarks" ? "landmarks" : "meetups";
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-12 sm:px-8 sm:pt-8">
        <HeroCarousel />
        <section aria-labelledby="feed-heading" className="mt-8 sm:mt-10">
          <h2 id="feed-heading" className="sr-only">{view === "landmarks" ? "Landmarks" : "Upcoming meetups"}</h2>
          <FeedViewToggle view={view} />
          {/* key: show the loading state again when switching views */}
          <Suspense key={view} fallback={<FeedLoading subject={view} />}>
            {view === "landmarks" ? <FeedLandmarks /> : <UpcomingMeetups />}
          </Suspense>
        </section>
      </main>
    </div>
  );
}
