import type { Metadata } from "next";
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
          <div className="mt-5 max-w-md">
            <p className="text-sm font-semibold text-stone-800">You&apos;ve unlocked {unlocked} of {landmarks.length} landmarks</p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={landmarks.length} aria-valuenow={unlocked} aria-label="Landmarks unlocked">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${(unlocked / landmarks.length) * 100}%` }} />
            </div>
          </div>
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
