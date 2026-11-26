import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Palette, ShieldCheck } from "lucide-react";
import { ReportButton } from "@/components/board/BoardControls";
import { CreatorAvatar } from "@/components/creators/CreatorAvatar";
import { DisciplineChips } from "@/components/creators/CreatorCard";
import { RequestForm } from "@/components/creators/RequestControls";
import { MartletNav } from "@/components/layout/MartletNav";
import { linkLabel } from "@/lib/creator-catalog";
import { getCreator, isCreatorPreview } from "@/lib/creators";

export const metadata: Metadata = { title: "Creator · McGill Martlet" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const outLink = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:border-brand focus-visible:outline-2 focus-visible:outline-focus";

/** Today in Montreal, for the date picker's minimum. */
const montrealToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const creator = await getCreator(id);
  const preview = isCreatorPreview();
  if (!creator) {
    if (preview) notFound();
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <MartletNav />
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
          <h1 className="text-2xl font-extrabold">Creator not available</h1>
          <p className="mt-2 text-ink-muted">The profile may have been deleted, or you need to <Link href={`/login?next=/creators/${id}`} className="font-bold text-brand-ink underline">sign in</Link>.</p>
          <Link href="/creators" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Back to creators</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-4xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/creators" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Creators</Link>

        <header className="mt-3 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <CreatorAvatar userId={creator.user_id} photoUrl={creator.photo_url} name={creator.name} className="size-20 sm:size-24" />
              <div className="min-w-0">
              <h1 className="text-3xl font-extrabold tracking-tight [overflow-wrap:anywhere]">{creator.is_mine ? `${creator.name} (you)` : creator.name}</h1>
              <p className="mt-1 text-lg text-ink-2 [overflow-wrap:anywhere]">{creator.headline}</p>
              </div>
            </div>
            {creator.is_mine && (
              <Link href="/creators/edit" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                <Palette aria-hidden="true" size={16} /> Edit profile
              </Link>
            )}
          </div>
          <div className="mt-3"><DisciplineChips disciplines={creator.disciplines} /></div>
          {creator.status === "hidden" && creator.is_mine && <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">Several students reported your profile, so it’s hidden until a moderator reviews it.</p>}
          {creator.bio && <p className="mt-5 leading-7 whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{creator.bio}</p>}
          {creator.rates && <p className="mt-4 text-sm"><span className="font-bold">Rates:</span> <span className="text-ink-2">{creator.rates}</span></p>}
          {creator.links.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Links">
              {creator.links.map((url) => (
                <li key={url}><a href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className={outLink}><ExternalLink aria-hidden="true" size={15} /> {linkLabel(url)}</a></li>
              ))}
            </ul>
          )}
          {!creator.is_mine && !preview && <div className="mt-3"><ReportButton type="creator" id={creator.user_id} /></div>}
        </header>

        <section aria-labelledby="portfolio-heading" className="mt-8">
          <h2 id="portfolio-heading" className="text-xl font-bold">Portfolio</h2>
          {creator.works.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">{creator.is_mine ? "Add your work from Edit profile." : "No work posted yet."}</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {creator.works.map((work) => (
                <li key={work.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  {work.image_url && (
                    <a href={work.image_url} target="_blank" rel="noreferrer" className="focus-visible:outline-2 focus-visible:outline-focus">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket */}
                      <img src={work.image_url} alt={work.title} loading="lazy" className="aspect-[4/3] w-full bg-surface-muted object-cover" />
                    </a>
                  )}
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="text-sm font-bold [overflow-wrap:anywhere]">{work.title}</h3>
                    {work.caption && <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">{work.caption}</p>}
                    {work.link && (
                      <a href={work.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-1 text-sm font-semibold text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                        <ExternalLink aria-hidden="true" size={15} /> Open on {linkLabel(work.link)}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!creator.is_mine && (
          <section aria-labelledby="request-heading" className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
            <h2 id="request-heading" className="text-xl font-bold">Request a commission or service</h2>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted"><ShieldCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0" /> Your request opens a private thread with {creator.name}. Agree on the price and timing there, meet on campus, and never pay in full in advance.</p>
            <div className="mt-4">
              {preview ? (
                <p className="text-sm text-ink-muted">Requests need Supabase. This is a preview.</p>
              ) : creator.open_for_requests ? (
                <RequestForm creatorId={creator.user_id} creatorName={creator.name} disciplines={creator.disciplines} today={montrealToday()} />
              ) : (
                <p className="text-sm text-ink-muted">{creator.name} is booked right now and isn’t taking new requests.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
