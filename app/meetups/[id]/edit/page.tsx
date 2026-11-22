import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { MeetupForm, type MeetupFormInitial } from "@/components/forms/MeetupForm";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { MartletNav } from "@/components/layout/MartletNav";
import type { Course } from "@/lib/course-codes";
import { listMyCourses, searchCourses } from "@/lib/courses";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { getMeetup } from "@/lib/meetups";
import { OTHER_LOCATION } from "@/lib/public-venues";
import type { MeetupSummary } from "@/types/meetup";

export const dynamic = "force-dynamic";

/** Map a saved meetup back to the form's location choice. */
function locationChoice(m: MeetupSummary): { locationId: string; customLocation: string } {
  const campus = CAMPUS_LOCATIONS.find((l) => l.name === m.location_name && l.latitude === m.latitude && l.longitude === m.longitude);
  if (campus) return { locationId: campus.id, customLocation: "" };
  // Custom spots and older public-venue meetups are edited as "Other" text.
  return { locationId: OTHER_LOCATION, customLocation: m.location_name };
}

async function findCourse(code: string | null): Promise<Course | null> {
  if (!code) return null;
  const matches = await searchCourses(code).catch(() => [] as Course[]);
  return matches.find((c) => c.code === code) ?? { code, title: "" } as Course;
}

/** Host of an open meetup that hasn't started yet (the database re-checks all of this). */
function isEditable(m: MeetupSummary, viewer: string | null) {
  return viewer === m.host_id && m.status === "open" && Date.parse(m.starts_at) > Date.now();
}

export default async function EditMeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meetup = await getMeetup(id);
  if (!meetup) notFound();
  const viewer = await getMeetupViewer();
  const href = `/meetups/${encodeURIComponent(meetup.id)}`;
  const editable = isEditable(meetup, viewer);

  let initial: MeetupFormInitial | null = null;
  let myCourses: Course[] = [];
  if (editable) {
    [myCourses, initial] = await Promise.all([
      listMyCourses().catch(() => []),
      findCourse(meetup.course_code ?? null).then((course) => ({
        title: meetup.title,
        description: meetup.description ?? "",
        category: meetup.category,
        ...locationChoice(meetup),
        startsAt: meetup.starts_at,
        course,
      })),
    ]);
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href={href} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Back to meetup</Link>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Edit meetup</h1>
        {editable && initial ? (
          <>
            <p className="mt-2 text-ink-muted">People who are going get a notification if you change the time or place.</p>
            <div className="mt-6"><MeetupForm myCourses={myCourses} edit={{ meetupId: meetup.id, initial }} /></div>
          </>
        ) : (
          <p role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 text-ink-2">
            <Lock aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-ink-muted" />
            {viewer !== meetup.host_id
              ? "Only the host can edit this meetup."
              : meetup.status !== "open" ? "Cancelled meetups can’t be edited." : "This meetup has already started, so it can’t be edited."}
          </p>
        )}
      </main>
    </div>
  );
}
