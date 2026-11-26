import Link from "next/link";
import { DISCIPLINE_INFO } from "@/lib/creator-catalog";
import type { Creator } from "@/lib/creators";
import { CreatorAvatar } from "./CreatorAvatar";

export function DisciplineChips({ disciplines }: { disciplines: Creator["disciplines"] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Kinds of work">
      {disciplines.map((d) => (
        <li key={d} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-ink-2">
          <span aria-hidden="true">{DISCIPLINE_INFO[d].emoji}</span> {DISCIPLINE_INFO[d].label}
        </li>
      ))}
    </ul>
  );
}

export function CreatorCard({ creator }: { creator: Creator }) {
  const emoji = DISCIPLINE_INFO[creator.disciplines[0] ?? "other"].emoji;
  return (
    <li className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:border-line-strong">
      {creator.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
        <img src={creator.cover_url} alt="" loading="lazy" className="aspect-[4/3] w-full bg-surface-muted object-cover" />
      ) : (
        <div aria-hidden="true" className="grid aspect-[4/3] w-full place-items-center bg-surface-muted text-5xl">{emoji}</div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="-mt-9 flex min-w-0 items-end gap-2">
          <CreatorAvatar userId={creator.user_id} photoUrl={creator.photo_url} name={creator.name} className="size-14" />
          <h2 className="pb-0.5 text-base font-extrabold leading-snug text-ink [overflow-wrap:anywhere]">
            <Link href={`/creators/${creator.user_id}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{creator.name}</Link>
          </h2>
          </div>
          {!creator.open_for_requests && <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-ink-2 ring-1 ring-line-strong">Booked</span>}
        </div>
        <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{creator.headline}</p>
        <DisciplineChips disciplines={creator.disciplines} />
        {creator.rates && <p className="mt-auto pt-1 text-xs text-ink-muted [overflow-wrap:anywhere]">{creator.rates}</p>}
      </div>
    </li>
  );
}
