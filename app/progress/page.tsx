import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Eye, LockKeyhole } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { GrowthTree, type TreeFruit } from "@/components/progress/GrowthTree";
import { listLandmarks, listMyUnlocks } from "@/lib/landmarks";
import { TREE_STAGES, treeStage, unlocksToNextStage, type TreeStage } from "@/lib/progress";
import { getDataMode } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Progress · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string | string[] }>;
}) {
  const [landmarks, myUnlocks, { stage: stageParam }] = await Promise.all([listLandmarks(), listMyUnlocks(), searchParams]);
  // Each photo the user has added hangs on the tree as a fruit linking back to it.
  const fruits: TreeFruit[] = myUnlocks.map((unlock) => ({
    landmarkId: unlock.landmark_id,
    landmarkName: unlock.landmark_name,
    caption: unlock.caption,
    photoUrl: unlock.photo_url,
    href: `/landmarks/${encodeURIComponent(unlock.landmark_id)}#my-photo`,
  }));
  const total = landmarks.length;
  const unlocked = landmarks.filter((l) => l.unlocked).length;
  const realStage = treeStage(unlocked, total);

  // /progress?stage=6 temporarily shows another growth stage. It only changes the picture,
  // never the user's real progress (the bar, checklist and unlocks stay as they are).
  const requested = typeof stageParam === "string" && /^[0-6]$/.test(stageParam) ? (Number(stageParam) as TreeStage) : null;
  const previewing = requested !== null && requested !== realStage;
  const stage = previewing ? requested : realStage;

  const toNext = unlocksToNextStage(unlocked, total);
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <p className="text-sm font-bold uppercase tracking-widest text-red-800">Your progress</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Grow your Martlet tree</h1>

        <section aria-label="Landmark progress" className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-stone-900">{unlocked} of {total} landmarks unlocked</p>
            <p className="text-sm font-bold text-amber-700">{percent}%</p>
          </div>
          <div
            role="progressbar"
            aria-label="Landmarks unlocked"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={unlocked}
            className="mt-3 h-3.5 overflow-hidden rounded-full bg-stone-200"
          >
            <div className="h-full rounded-full bg-gradient-to-r from-lime-500 to-emerald-600 transition-[width] duration-700" style={{ width: `${percent}%` }} />
          </div>
        </section>

        {previewing && (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <Eye aria-hidden="true" size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">
              Previewing <strong>{TREE_STAGES[stage]}</strong>. Your real progress hasn&apos;t changed.{" "}
              <Link href="/progress" scroll={false} className="font-bold whitespace-nowrap underline">Back to your tree</Link>
            </span>
          </p>
        )}
        {getDataMode() === "mock" && !previewing && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Demo mode: unlocking needs Supabase, so your tree is still a seed.
          </p>
        )}

        <section aria-labelledby="tree-heading" className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <div className="rounded-xl border border-stone-200">
            <GrowthTree stage={stage} unlocked={unlocked} total={total} preview={previewing} fruits={fruits} />
          </div>
          <h2 id="tree-heading" className="mt-3 text-2xl font-extrabold tracking-tight">{TREE_STAGES[stage]}</h2>
          <p className="mt-1 text-stone-600">
            {previewing
              ? `This is what your tree looks like at the ${TREE_STAGES[stage].toLowerCase()} stage.`
              : toNext === null
              ? "Every landmark unlocked. Your tree is in full bloom!"
              : `Unlock ${toNext} more ${toNext === 1 ? "landmark" : "landmarks"} to ${stage + 1 === TREE_STAGES.length - 1
                ? "reach full bloom"
                : `grow into a ${TREE_STAGES[stage + 1].toLowerCase()}`}.`}
          </p>
          {fruits.length > 0 && (
            <p className="mt-2 text-sm text-stone-600">
              Each <span className="font-semibold text-red-700">apple</span> is one of your landmark photos. Hover to preview it, or tap to open it.
            </p>
          )}
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-stone-500">Tap a stage to preview it</p>
          <ol aria-label="Growth stages" className="mt-2 flex flex-wrap justify-center gap-1.5">
            {TREE_STAGES.map((name, i) => {
              const shown = i === stage;
              const reached = i <= realStage;
              return (
                <li key={name}>
                  <Link
                    href={i === realStage ? "/progress" : `/progress?stage=${i}`}
                    scroll={false}
                    aria-current={shown ? "step" : undefined}
                    aria-label={`${name}${i === realStage ? " (your stage)" : reached ? " (reached)" : ""}${shown && previewing ? ", previewing" : ""}`}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                      shown
                        ? "bg-emerald-700 text-white"
                        : reached
                          ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    } ${i === realStage && !shown ? "ring-2 ring-emerald-600" : ""}`}
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="landmarks-heading" className="mt-8">
          <h2 id="landmarks-heading" className="text-xl font-bold">Your landmarks</h2>
          <ul className="mt-3 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {landmarks.map((landmark) => (
              <li key={landmark.id}>
                <Link href={`/landmarks/${encodeURIComponent(landmark.id)}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-700">
                  {landmark.unlocked
                    ? <CheckCircle2 aria-hidden="true" size={20} className="shrink-0 text-emerald-600" />
                    : <LockKeyhole aria-hidden="true" size={20} className="shrink-0 text-stone-400" />}
                  <span className="flex-1 font-semibold text-stone-900">{landmark.name}</span>
                  <span className="text-xs font-medium text-stone-500">{landmark.unlocked ? "Unlocked" : "Locked"}</span>
                  <ArrowUpRight aria-hidden="true" size={16} className="text-red-800" />
                </Link>
              </li>
            ))}
          </ul>
          {landmarks.length === 0 && <p className="mt-3 text-stone-600">No landmarks yet.</p>}
        </section>
      </main>
    </div>
  );
}
