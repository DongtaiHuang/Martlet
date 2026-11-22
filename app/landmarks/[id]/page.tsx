import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, LockKeyhole, Star, UsersRound } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { LandmarkGallery } from "@/components/landmarks/LandmarkGallery";
import { UnlockForm } from "@/components/landmarks/UnlockForm";
import { LANDMARK_COLORS, landmarkZoom } from "@/components/map/landmark-style";
import { MeetupLocationMap } from "@/components/map/MeetupLocationMap";
import { getLandmark, listLandmarkPhotos } from "@/lib/landmarks";
import { getDataMode } from "@/lib/supabase/env";
import { saveUnlockAction } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const landmark = await getLandmark((await params).id);
  return { title: `${landmark?.name ?? "Landmark"} · McGill Martlet` };
}

export default async function LandmarkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landmark = await getLandmark(id);
  if (!landmark) notFound();
  const photos = landmark.unlocked ? await listLandmarkPhotos(landmark.id) : [];
  const others = landmark.unlock_count - (landmark.unlocked ? 1 : 0);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/landmarks" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline">
          <ArrowLeft aria-hidden="true" size={16} /> All landmarks
        </Link>

        <section aria-labelledby="gallery-heading" className="mt-3">
          <h2 id="gallery-heading" className="text-xl font-bold">Photos from {landmark.name}</h2>
          <div className="mt-4">
            {landmark.unlocked ? (
              <LandmarkGallery photos={photos} landmarkName={landmark.name} />
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 text-center">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-2 p-2 opacity-60 blur-sm">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="rounded-lg bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-800 dark:to-stone-700" />
                  ))}
                </div>
                <div className="relative py-6">
                  <LockKeyhole aria-hidden="true" size={28} className="mx-auto text-ink-muted" />
                  <p className="mt-2 font-semibold text-ink-soft">
                    {others > 0
                      ? `Unlock to see ${others} ${others === 1 ? "photo" : "photos"} from other students.`
                      : "Be the first to unlock this landmark."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <article className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${landmark.unlocked ? "bg-warn-muted text-warn-ink" : "bg-surface-muted text-ink-2"}`}>
              {landmark.unlocked ? <Star aria-hidden="true" size={14} /> : <LockKeyhole aria-hidden="true" size={14} />}
              {landmark.unlocked ? "Unlocked" : "Locked"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-2">
              <UsersRound aria-hidden="true" size={14} /> {landmark.unlock_count} unlocked
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{landmark.name}</h1>
          {landmark.description && <p className="mt-2 text-ink-2">{landmark.description}</p>}

          <section aria-labelledby="challenge-heading" className="mt-5 rounded-xl bg-brand-soft p-4">
            <h2 id="challenge-heading" className="flex items-center gap-2 text-sm font-bold text-brand-ink-strong">
              <Camera aria-hidden="true" size={17} /> The challenge
            </h2>
            <p className="mt-1 text-ink-soft">{landmark.challenge_prompt}</p>
          </section>

          <section aria-label="Landmark location" className="mt-5">
            <MeetupLocationMap
              color={landmark.unlocked ? LANDMARK_COLORS.unlocked : LANDMARK_COLORS.locked}
              locationName={landmark.name}
              latitude={landmark.latitude}
              longitude={landmark.longitude}
              zoom={landmarkZoom(landmark.radius_m)}
            />
          </section>

          <section id="edit-my-photo" aria-labelledby="unlock-heading" className="mt-7 border-t border-line pt-6">
            <h2 id="unlock-heading" className="text-lg font-bold">{landmark.unlocked ? "Your unlock" : "Unlock this landmark"}</h2>
            {getDataMode() === "mock" && (
              <p className="mt-2 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">
                Demo mode: unlocking needs Supabase to be configured.
              </p>
            )}
            {landmark.my_unlock && !landmark.my_unlock.photo_url && (
              <p role="alert" className="mt-2 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">
                Your photo is missing (the upload may have failed). Add it again below.
              </p>
            )}
            <div className="mt-4">
              <UnlockForm
                action={saveUnlockAction.bind(null, landmark.id)}
                unlocked={landmark.unlocked}
                currentCaption={landmark.my_unlock?.caption ?? ""}
              />
            </div>
          </section>
        </article>

      </main>
    </div>
  );
}
