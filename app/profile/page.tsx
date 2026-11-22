import Link from "next/link";
import { ArrowRight, Bird, LogIn, Trophy, UserRound } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { DisplayNameForm } from "@/components/profile/DisplayNameForm";
import { ProfileActivity } from "@/components/profile/ProfileActivity";
import { getCurrentUser, type CurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type ProfileState =
  | { kind: "preview" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; user: CurrentUser };

async function loadProfile(): Promise<ProfileState> {
  if (getDataMode() === "mock") return { kind: "preview" };
  try {
    const user = await getCurrentUser();
    if (!user) return { kind: "signed-out" };
    return { kind: "ready", user };
  } catch (error) {
    console.error("Failed to load the student profile", error);
    return { kind: "error" };
  }
}

export default async function ProfilePage() {
  const state = await loadProfile();
  const linkClass = "font-bold text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700";

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Student profile</h1>
        <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-900"><UserRound aria-hidden="true" size={24} /></div>
            <div className="min-w-0">
              {state.kind === "ready" ? (
                <>
                  <h2 className="text-xl font-bold [overflow-wrap:anywhere]">{state.user.display_name}</h2>
                  {state.user.email && <p className="mt-1 text-sm text-stone-600 [overflow-wrap:anywhere]">Signed in as {state.user.email}</p>}
                </>
              ) : state.kind === "signed-out" ? (
                <>
                  <h2 className="text-xl font-bold">You’re signed out</h2>
                  <p className="mt-1 text-sm text-stone-600">Sign in to see the meetups you host and join.</p>
                </>
              ) : state.kind === "preview" ? (
                <>
                  <h2 className="text-xl font-bold">Preview mode</h2>
                  <p className="mt-1 text-sm text-stone-600">Student accounts need Supabase. See <code>docs/SUPABASE_SETUP.md</code>.</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold">Profile unavailable</h2>
                  <p role="alert" className="mt-1 text-sm text-stone-600">Couldn’t load your profile. Refresh the page to try again.</p>
                </>
              )}
            </div>
          </div>
          {state.kind === "ready" && <DisplayNameForm current={state.user.display_name} />}
          {state.kind === "ready" && (
            <Link href="/avatar" className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 hover:border-red-300 focus-visible:outline-2 focus-visible:outline-red-700">
              <Bird aria-hidden="true" size={22} className="shrink-0 text-red-800" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">Your martlet</span>
                <span className="block text-xs text-stone-600">Customize your 3D avatar and make it copy your expressions.</span>
              </span>
              <ArrowRight aria-hidden="true" size={16} className="ml-auto shrink-0 text-red-800" />
            </Link>
          )}
          {/* Everyone can open achievements; guests' are kept in the browser. */}
          <Link href="/achievements" className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 hover:border-red-300 focus-visible:outline-2 focus-visible:outline-red-700">
            <Trophy aria-hidden="true" size={22} className="shrink-0 text-amber-600" />
            <span className="min-w-0">
              <span className="block text-sm font-bold">Achievements</span>
              <span className="block text-xs text-stone-600">Badges for finding Martlet’s niche and hidden features.</span>
            </span>
            <ArrowRight aria-hidden="true" size={16} className="ml-auto shrink-0 text-red-800" />
          </Link>
          {state.kind === "signed-out" ? (
            <Link href="/login?next=/profile" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><LogIn aria-hidden="true" size={16} /> Sign in</Link>
          ) : (
            <Link href="/meetups" className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm ${linkClass}`}>Browse meetups <ArrowRight aria-hidden="true" size={16} /></Link>
          )}
        </div>

        {state.kind === "ready" && <ProfileActivity viewerId={state.user.id} />}
      </main>
    </div>
  );
}
