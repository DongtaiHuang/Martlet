import type { Metadata } from "next";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { LandmarkMap } from "@/components/map/LandmarkMap";
import { listLandmarks } from "@/lib/landmarks";
import { getDataMode } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Landmarks · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function LandmarksPage() {
  const landmarks = await listLandmarks();
  const unlocked = landmarks.filter((l) => l.unlocked).length;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
        <p className="text-sm font-bold uppercase tracking-widest text-red-800">Martlet Landmarks</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Go there. Snap it. Unlock it.</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Visit a landmark, take a photo of yourself doing its challenge, and unlock everyone else&apos;s photos from there.
        </p>
        {landmarks.length > 0 && (
          <Link href="/progress" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:border-emerald-400 focus-visible:outline-2 focus-visible:outline-red-700">
            <Sprout aria-hidden="true" size={17} /> {unlocked} of {landmarks.length} unlocked · See your tree
          </Link>
        )}
        {getDataMode() === "mock" && (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Demo mode: landmarks are shown, but unlocking needs Supabase to be configured.
          </p>
        )}
        <LandmarkMap landmarks={landmarks} />
      </main>
    </div>
  );
}
