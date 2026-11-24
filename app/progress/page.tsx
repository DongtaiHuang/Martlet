import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowUpRight, CheckCircle2, Eye, LockKeyhole } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { EarnOnMount } from "@/components/achievements/EarnOnMount";
import { EarnActivity } from "@/components/achievements/EarnActivity";
import { GrowthTree, type TreeFruit } from "@/components/progress/GrowthTree";
import { loadActivityCounts } from "@/lib/activity-counts";
import { satisfiedActivityAchievements } from "@/lib/activity-achievements";
import { listLandmarks, listMyUnlocks } from "@/lib/landmarks";
import {
  BLOOM_LEVELS, BLOOM_THRESHOLDS, bloomLevel, meetupsToNextBloom, parseSpecies, SPECIES_COOKIE, SPECIES_INFO, TREE_SPECIES,
  TREE_STAGES, treeStage, unlocksToNextStage, type BloomLevel, type TreeStage,
} from "@/lib/progress";
import { treeColors } from "@/components/progress/pixel-tree";
import { chooseSpecies } from "./actions";
import { getDataMode } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Progress · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string | string[]; bloom?: string | string[] }>;
}) {
  const [landmarks, myUnlocks, { stage: stageParam, bloom: bloomParam }, cookieStore, activityCounts] = await Promise.all([
    listLandmarks(), listMyUnlocks(), searchParams, cookies(), loadActivityCounts(),
  ]);
  const species = parseSpecies(cookieStore.get(SPECIES_COOKIE)?.value);
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

  // After full bloom the tree keeps growing with meetups hosted + joined (ADR 0030).
  const meetups = (activityCounts?.hosted ?? 0) + (activityCounts?.joined ?? 0);
  const realBloom: BloomLevel = realStage === 6 ? bloomLevel(meetups) : 0;
  const requestedBloom = typeof bloomParam === "string" && /^[0-3]$/.test(bloomParam) ? (Number(bloomParam) as BloomLevel) : null;
  const bloom: BloomLevel = stage === 6 ? (requestedBloom ?? (previewing ? 0 : realBloom)) : 0;
  const previewingBloom = stage === 6 && bloom !== realBloom;
  const showingPreview = previewing || previewingBloom;
  const stageName = stage === 6 ? BLOOM_LEVELS[bloom] : TREE_STAGES[stage];
  const toNextBloom = meetupsToNextBloom(meetups);

  const toNext = unlocksToNextStage(unlocked, total);
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  // Activity ladders (ADR 0020): earn any that this visit satisfies.
  const earnedActivity = activityCounts ? satisfiedActivityAchievements(activityCounts) : [];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <EarnActivity ids={earnedActivity} />
        <p className="text-sm font-bold uppercase tracking-widest text-brand-ink">Your progress</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Grow your Martlet tree</h1>

        <section aria-label="Landmark progress" className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-ink-soft">{unlocked} of {total} landmarks unlocked</p>
            <p className="text-sm font-bold text-amber-700">{percent}%</p>
          </div>
          <div
            role="progressbar"
            aria-label="Landmarks unlocked"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={unlocked}
            className="mt-3 h-3.5 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full rounded-full bg-gradient-to-r from-lime-500 to-emerald-600 transition-[width] duration-700" style={{ width: `${percent}%` }} />
          </div>
        </section>

        {showingPreview && <EarnOnMount id="time-traveller" />}
        {showingPreview && (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
            <Eye aria-hidden="true" size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">
              Previewing <strong>{stageName}</strong>. Your real progress hasn&apos;t changed.{" "}
              <Link href="/progress" scroll={false} className="font-bold whitespace-nowrap underline">Back to your tree</Link>
            </span>
          </p>
        )}
        {getDataMode() === "mock" && !showingPreview && (
          <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">
            Demo mode: unlocking needs Supabase, so your tree is still a seed.
          </p>
        )}

        <section aria-labelledby="tree-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 text-center shadow-sm sm:p-8">
          <div className="rounded-xl border border-line">
            <GrowthTree stage={stage} unlocked={unlocked} total={total} preview={showingPreview} fruits={fruits} species={species} bloom={bloom} />
          </div>
          <h2 id="tree-heading" className="mt-3 text-2xl font-extrabold tracking-tight">{stageName}</h2>
          <p className="mt-1 text-ink-muted">
            {showingPreview
              ? `This is what your ${SPECIES_INFO[species].label.toLowerCase()} looks like as a ${stageName.toLowerCase()}.`
              : toNext === null
              ? toNextBloom === null
                ? "Every landmark unlocked and plenty of meetups: your tree is ancient!"
                : `Every landmark unlocked. Join or host ${toNextBloom} more ${toNextBloom === 1 ? "meetup" : "meetups"} to grow into a ${BLOOM_LEVELS[bloom + 1].toLowerCase()}.`
              : `Unlock ${toNext} more ${toNext === 1 ? "landmark" : "landmarks"} to ${stage + 1 === TREE_STAGES.length - 1
                ? "reach full bloom"
                : `grow into a ${TREE_STAGES[stage + 1].toLowerCase()}`}.`}
          </p>
          {fruits.length > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              Each <span className="font-semibold text-brand-ink">apple</span> is one of your landmark photos. Hover to preview it, or tap to open it.
            </p>
          )}
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Tap a stage to preview it</p>
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
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      shown
                        ? "bg-emerald-700 text-white"
                        : reached
                          ? "bg-ok-soft text-ok-ink hover:bg-emerald-200"
                          : "bg-surface-muted text-ink-muted hover:bg-line"
                    } ${i === realStage && !shown ? "ring-2 ring-emerald-600" : ""}`}
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-subtle">After full bloom: grows with meetups</p>
          <ol aria-label="Levels after full bloom" className="mt-2 flex flex-wrap justify-center gap-1.5">
            {BLOOM_LEVELS.slice(1).map((name, index) => {
              const level = (index + 1) as BloomLevel;
              const shown = stage === 6 && bloom === level;
              const reached = realStage === 6 && realBloom >= level;
              const mine = realStage === 6 && realBloom === level;
              return (
                <li key={name}>
                  <Link
                    href={mine ? "/progress" : `/progress?stage=6&bloom=${level}`}
                    scroll={false}
                    aria-current={shown ? "step" : undefined}
                    aria-label={`${name}, ${BLOOM_THRESHOLDS[level]} meetups${mine ? " (your level)" : reached ? " (reached)" : ""}${shown && showingPreview ? ", previewing" : ""}`}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      shown ? "bg-emerald-700 text-white" : reached ? "bg-ok-soft text-ok-ink hover:bg-emerald-200" : "bg-surface-muted text-ink-muted hover:bg-line"
                    } ${mine && !shown ? "ring-2 ring-emerald-600" : ""}`}
                  >
                    {name} · {BLOOM_THRESHOLDS[level]}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Species picker (issue #133, ADR 0030): a form, so it works without JavaScript. */}
        <section aria-labelledby="species-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <h2 id="species-heading" className="text-lg font-bold">Choose your tree</h2>
          <p className="mt-1 text-sm text-ink-muted">Same progress, different tree. Saved on this device.</p>
          <form action={chooseSpecies} className="mt-3 grid gap-2 sm:grid-cols-3">
            {TREE_SPECIES.map((id) => {
              const on = id === species;
              const swatch = treeColors("color", id);
              return (
                <button
                  key={id} type="submit" name="species" value={id} aria-pressed={on}
                  className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${on ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong"}`}
                >
                  <span aria-hidden="true" className="flex size-7 shrink-0 overflow-hidden rounded-full border border-line">
                    <span className="w-1/2" style={{ background: swatch.leaf2 }} /><span className="w-1/2" style={{ background: swatch.wood }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{SPECIES_INFO[id].label}</span>
                    <span className="block text-xs text-ink-muted">{SPECIES_INFO[id].description}</span>
                  </span>
                </button>
              );
            })}
          </form>
        </section>

        <section aria-labelledby="landmarks-heading" className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h2 id="landmarks-heading" className="text-lg font-bold">Your landmarks</h2>
            <p className="text-xs font-medium text-ink-subtle">{total} · {unlocked} unlocked</p>
          </div>
          {/* Fixed height that scrolls inside, so a long list doesn't stretch the page. */}
          <div className="relative">
            <ul className="grid max-h-80 gap-px overflow-y-auto overscroll-contain bg-line sm:grid-cols-2">
              {landmarks.map((landmark) => (
                <li key={landmark.id} className="bg-surface sm:last:odd:col-span-2">
                  <Link href={`/landmarks/${encodeURIComponent(landmark.id)}`} className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
                    {landmark.unlocked
                      ? <CheckCircle2 aria-hidden="true" size={18} className="shrink-0 text-emerald-600" />
                      : <LockKeyhole aria-hidden="true" size={18} className="shrink-0 text-stone-400" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-soft">{landmark.name}</span>
                    <span className="text-xs font-medium text-ink-subtle">{landmark.unlocked ? "Unlocked" : "Locked"}</span>
                    <ArrowUpRight aria-hidden="true" size={15} className="shrink-0 text-brand-ink" />
                  </Link>
                </li>
              ))}
            </ul>
            {/* Hint that there's more to scroll when the list is longer than the box. */}
            {landmarks.length > 6 && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
          {landmarks.length === 0 && <p className="px-4 py-3 text-sm text-ink-muted">No landmarks yet.</p>}
        </section>
      </main>
    </div>
  );
}
