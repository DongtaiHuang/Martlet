import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound, UsersRound } from "lucide-react";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { MartletNav } from "@/components/layout/MartletNav";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadProfile() {
  if (!getSupabaseConfig()) {
    return { name: "Guest", message: "Student accounts aren’t available in this preview." };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error && !isAuthSessionMissingError(error)) throw error;
    if (!user) {
      return { name: "Guest", message: "Sign in when student accounts are available to view your profile." };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    return { name: profile?.display_name || "Martlet student", message: "Signed in to McGill Martlet." };
  } catch (error) {
    console.error("Failed to load the student profile", error);
    return { name: "Profile unavailable", message: "Refresh the page to try again." };
  }
}

export default async function ProfilePage() {
  const { name, message } = await loadProfile();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Student profile</h1>
        <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-900"><UserRound aria-hidden="true" size={24} /></div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold [overflow-wrap:anywhere]">{name}</h2>
              <p className="mt-1 text-sm text-stone-600">{message}</p>
            </div>
          </div>
          <Link href="/meetups" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700">Browse meetups <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
        <section aria-labelledby="activity-heading" className="mt-8">
          <h2 id="activity-heading" className="text-xl font-bold">Your activity</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="flex items-center gap-2 font-semibold"><CalendarDays aria-hidden="true" size={17} className="text-red-800" /> Hosted meetups</h3>
              <p className="mt-2 text-sm text-stone-600">Available when meetup creation is connected.</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="flex items-center gap-2 font-semibold"><UsersRound aria-hidden="true" size={17} className="text-red-800" /> Joined meetups</h3>
              <p className="mt-2 text-sm text-stone-600">Available when Peck is connected.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
