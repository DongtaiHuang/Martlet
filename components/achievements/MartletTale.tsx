"use client";

import { BookOpen, LockKeyhole } from "lucide-react";
import { ACHIEVEMENTS, type EarnedMap } from "@/lib/achievement-catalog";
import { useEarned } from "./useEarned";

/**
 * "The Martlet's Tale": a short story in four chapters. A chapter unlocks at each quarter
 * of the achievements; the last one only when every achievement is unlocked.
 * McGill's crest carries three martlets, heraldic birds drawn without feet, said never to land.
 */
const CHAPTERS = [
  {
    title: "I. The bird without feet",
    text: "Long before the Roddick Gates, a martlet flew over the mountain. Martlets have no feet, the old heralds said, so they can never land. They only fly, and they only look for somewhere worth arriving. From the sky this one saw a meadow, a farmhouse and a man named James planting an idea.",
  },
  {
    title: "II. The three on the shield",
    text: "The idea grew into stone halls. When the founders drew a crest, the martlet was there, and it had brought two friends. Three red birds on a white shield: one for those who came to learn, one for those who stayed to teach, one for those still on their way. Students walked under them every morning and never looked up.",
  },
  {
    title: "III. Where the martlets hide",
    text: "But martlets get bored on shields. On quiet nights they slip off the banners and go exploring. They perch on the Biosphère, nap by the observatory dome, count the steps up to the Arts Building and whisper to anyone who hovers long enough. They hide jokes in old maps and secrets in key sequences. Only the curious ever find them.",
  },
  {
    title: "IV. The landing",
    text: "You found them all. You followed the birds across campus and the city, through every theme and every hidden corner. And here is the secret the heralds never wrote down: martlets can land after all. They only need a flock worth landing with. Welcome to yours. 🐦",
  },
] as const;

export function MartletTale({ earned: account }: { earned: EarnedMap | null }) {
  const earned = useEarned(account);
  const total = ACHIEVEMENTS.length;
  const done = ACHIEVEMENTS.filter((a) => earned[a.id]).length;
  // Chapter i (0-based) needs ceil(total * (i + 1) / 4) achievements; the last needs all.
  const needed = CHAPTERS.map((_, i) => (i === CHAPTERS.length - 1 ? total : Math.ceil((total * (i + 1)) / CHAPTERS.length)));
  const open = needed.filter((n) => done >= n).length;

  return (
    <section aria-labelledby="tale-heading" className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tale-heading" className="flex items-center gap-2 text-xl font-bold"><BookOpen aria-hidden="true" size={20} className="text-brand-ink" /> The Martlet’s Tale</h2>
        <p className="text-sm font-semibold text-ink-muted">{open} of {CHAPTERS.length} chapters</p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">A story in four pieces. Every quarter of the achievements unlocks the next; the ending needs all of them.</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {CHAPTERS.map((c, i) => {
          const unlocked = done >= needed[i];
          return (
            <li key={c.title} className={`relative overflow-hidden rounded-xl border p-4 ${unlocked ? "border-brand-line bg-brand-soft/40" : "border-line bg-surface-muted"}`}>
              <h3 className="font-bold text-ink">{c.title}</h3>
              {unlocked ? (
                <p className="mt-1.5 text-sm leading-6 text-ink-2 motion-safe:animate-[martlet-fade-in_500ms_ease-out]">{c.text}</p>
              ) : (
                <>
                  <p aria-hidden="true" className="mt-1.5 text-sm leading-6 text-ink-2 blur-[5px] select-none">{c.text.slice(0, 140)}…</p>
                  <p className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-soft">
                    <LockKeyhole aria-hidden="true" size={15} />
                    {i === CHAPTERS.length - 1 ? "Unlock every achievement" : `Unlock ${needed[i]} achievements`} ({done}/{needed[i]})
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
