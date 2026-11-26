import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Palette, Search } from "lucide-react";
import { CreatorCard } from "@/components/creators/CreatorCard";
import { MartletNav } from "@/components/layout/MartletNav";
import { DISCIPLINES, DISCIPLINE_INFO, type Discipline } from "@/lib/creator-catalog";
import { getMyCreator, isCreatorPreview, listCreators } from "@/lib/creators";

export const metadata: Metadata = { title: "Creators · McGill Martlet" };
export const dynamic = "force-dynamic";

const chip = (on: boolean) => `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${on ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink-2 hover:border-brand"}`;
const action = "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

type Params = { discipline?: string; q?: string; open?: string };

function href(current: Params, change: Params) {
  const next = { ...current, ...change };
  const query = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])));
  const text = query.toString();
  return text ? `/creators?${text}` : "/creators";
}

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const discipline = DISCIPLINES.includes(params.discipline as Discipline) ? (params.discipline as Discipline) : undefined;
  const open = params.open === "1";
  const q = (params.q ?? "").slice(0, 60);
  const current: Params = { discipline, q: q || undefined, open: open ? "1" : undefined };
  const preview = isCreatorPreview();
  const [creators, mine] = await Promise.all([listCreators({ discipline, q, open }), preview ? null : getMyCreator()]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Creators</h1>
            <p className="mt-2 text-ink-muted">McGill students who make music, code, take photos, draw, design or tutor. Browse their work and send a request for a commission or a lesson. Martlet never handles money.</p>
          </div>
          {!preview && creators !== null && (
            <div className="flex flex-wrap gap-2">
              <Link href="/creators/requests" className={`${action} border border-line-strong bg-surface text-ink hover:border-brand`}><Inbox aria-hidden="true" size={16} /> Requests</Link>
              <Link href="/creators/edit" className={`${action} bg-brand text-on-brand hover:bg-brand-hover`}><Palette aria-hidden="true" size={16} /> {mine ? "Your profile" : "Create your profile"}</Link>
            </div>
          )}
        </div>
        {preview && <p className="mt-4 rounded-xl border border-line bg-surface p-3 text-sm text-ink-muted">Preview mode: these are sample creators. Connect Supabase to make a profile and send requests.</p>}

        {creators === null ? (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="font-semibold">Creators are for signed-in McGill students.</p>
            <Link href="/login?next=/creators" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-focus">Sign in</Link>
          </div>
        ) : (
          <>
            <form action="/creators" className="mt-6 flex flex-wrap gap-2" role="search">
              {discipline && <input type="hidden" name="discipline" value={discipline} />}
              <label className="relative min-w-0 flex-1 basis-60">
                <span className="sr-only">Search creators</span>
                <Search aria-hidden="true" size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
                <input name="q" defaultValue={q} maxLength={60} placeholder="Search: portraits, guitar, React, COMP 250…" className="min-h-11 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-9 text-ink focus-visible:outline-2 focus-visible:outline-focus" />
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold">
                <input type="checkbox" name="open" value="1" defaultChecked={open} className="size-4 accent-[var(--m-brand)]" /> Open for requests
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:border-brand focus-visible:outline-2 focus-visible:outline-focus">Search</button>
            </form>

            <nav aria-label="Kinds of work" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <Link href={href(current, { discipline: undefined })} aria-current={!discipline ? "page" : undefined} className={chip(!discipline)}>All</Link>
              {DISCIPLINES.map((d) => (
                <Link key={d} href={href(current, { discipline: d })} aria-current={discipline === d ? "page" : undefined} className={chip(discipline === d)}>
                  <span aria-hidden="true">{DISCIPLINE_INFO[d].emoji}</span>{DISCIPLINE_INFO[d].label}
                </Link>
              ))}
            </nav>

            {creators.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center text-ink-muted">
                {q || discipline || open ? "Nobody matches yet. Try another search or kind of work." : "No creators yet. Be the first to share your work!"}
              </p>
            ) : (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {creators.map((creator) => <CreatorCard key={creator.user_id} creator={creator} />)}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
