import Link from "next/link";
import { ArrowRight, Bird, LogIn, MessagesSquare, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { CourseCodesForm } from "@/components/courses/CourseCodesForm";
import { AppearancePicker } from "@/components/settings/AppearancePicker";
import { BlockedPeople } from "@/components/profile/BlockedPeople";
import { MartletNav } from "@/components/layout/MartletNav";
import { DisplayNameForm } from "@/components/profile/DisplayNameForm";
import { ProfileActivity } from "@/components/profile/ProfileActivity";
import type { Course } from "@/lib/course-codes";
import { isModerator } from "@/lib/board";
import { listMyCourses } from "@/lib/courses";
import { getCurrentUser, type CurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type ProfileState =
  | { kind: "preview" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; user: CurrentUser; courses: Course[] | null };

async function loadProfile(): Promise<ProfileState> {
  if (getDataMode() === "mock") return { kind: "preview" };
  try {
    const user = await getCurrentUser();
    if (!user) return { kind: "signed-out" };
    // Courses are optional: if they fail to load (e.g. migration 007 not applied yet), the profile still works.
    const courses = await listMyCourses().catch((error) => {
      console.error("Failed to load the student's courses", error);
      return null;
    });
    return { kind: "ready", user, courses };
  } catch (error) {
    console.error("Failed to load the student profile", error);
    return { kind: "error" };
  }
}

export default async function ProfilePage() {
  const state = await loadProfile();
  const moderator = state.kind === "ready" ? await isModerator().catch(() => false) : false;
  const linkClass = "font-bold text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-focus";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Student profile</h1>
        <div className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-muted text-brand-ink-strong"><UserRound aria-hidden="true" size={24} /></div>
            <div className="min-w-0">
              {state.kind === "ready" ? (
                <>
                  <h2 className="text-xl font-bold [overflow-wrap:anywhere]">{state.user.display_name}</h2>
                  {state.user.email && <p className="mt-1 text-sm text-ink-muted [overflow-wrap:anywhere]">Signed in as {state.user.email}</p>}
                </>
              ) : state.kind === "signed-out" ? (
                <>
                  <h2 className="text-xl font-bold">You’re signed out</h2>
                  <p className="mt-1 text-sm text-ink-muted">Sign in to see the meetups you host and join.</p>
                </>
              ) : state.kind === "preview" ? (
                <>
                  <h2 className="text-xl font-bold">Preview mode</h2>
                  <p className="mt-1 text-sm text-ink-muted">Student accounts need Supabase. See <code>docs/SUPABASE_SETUP.md</code>.</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold">Profile unavailable</h2>
                  <p role="alert" className="mt-1 text-sm text-ink-muted">Couldn’t load your profile. Refresh the page to try again.</p>
                </>
              )}
            </div>
          </div>
          {state.kind === "ready" && <DisplayNameForm current={state.user.display_name} />}
          {state.kind === "ready" && state.courses && <CourseCodesForm initial={state.courses} />}
          {state.kind === "ready" && (<>
            <Link href="/avatar" className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3 hover:border-brand-line focus-visible:outline-2 focus-visible:outline-focus">
              <Bird aria-hidden="true" size={22} className="shrink-0 text-brand-ink" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">Your martlet</span>
                <span className="block text-xs text-ink-muted">Customize your 3D avatar and make it copy your expressions.</span>
              </span>
              <ArrowRight aria-hidden="true" size={16} className="ml-auto shrink-0 text-brand-ink" />
            </Link>
          </>)}
          {state.kind === "ready" && (<>
            <Link href="/board" className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3 hover:border-brand-line focus-visible:outline-2 focus-visible:outline-focus">
              <MessagesSquare aria-hidden="true" size={22} className="shrink-0 text-brand-ink" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">Campus board</span>
                <span className="block text-xs text-ink-muted">Memes, tips and questions from other students.</span>
              </span>
              <ArrowRight aria-hidden="true" size={16} className="ml-auto shrink-0 text-brand-ink" />
            </Link>
            {moderator && (
              <Link href="/moderation" className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3 hover:border-brand-line focus-visible:outline-2 focus-visible:outline-focus">
                <ShieldCheck aria-hidden="true" size={22} className="shrink-0 text-ok-ink" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">Moderation</span>
                  <span className="block text-xs text-ink-muted">Review reported posts and comments.</span>
                </span>
                <ArrowRight aria-hidden="true" size={16} className="ml-auto shrink-0 text-brand-ink" />
              </Link>
            )}
          </>)}
          {/* Everyone can open achievements; guests' are kept in the browser. */}
          <Link href="/achievements" className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3 hover:border-brand-line focus-visible:outline-2 focus-visible:outline-focus">
            <Trophy aria-hidden="true" size={22} className="shrink-0 text-amber-600" />
            <span className="min-w-0">
              <span className="block text-sm font-bold">Achievements</span>
              <span className="block text-xs text-ink-muted">Badges for finding Martlet’s niche and hidden features.</span>
            </span>
            <ArrowRight aria-hidden="true" size={16} className="ml-auto shrink-0 text-brand-ink" />
          </Link>
          {state.kind === "signed-out" ? (
            <Link href="/login?next=/profile" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><LogIn aria-hidden="true" size={16} /> Sign in</Link>
          ) : (
            <Link href="/meetups" className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm ${linkClass}`}>Browse meetups <ArrowRight aria-hidden="true" size={16} /></Link>
          )}
        </div>

        {state.kind === "ready" && <ProfileActivity viewerId={state.user.id} />}
        {state.kind === "ready" && <BlockedPeople />}
        <AppearancePicker />
      </main>
    </div>
  );
}
