import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, MessagesSquare, ShieldCheck, UserRound } from "lucide-react";
import { ReportButton } from "@/components/board/BoardControls";
import { MartletNav } from "@/components/layout/MartletNav";
import { MessageThread, SellerControls } from "@/components/marketplace/ListingControls";
import { StatusBadge } from "@/components/marketplace/ListingCard";
import { getListing, isMarketplacePreview } from "@/lib/marketplace";
import { CATEGORY_INFO, CONDITION_LABELS, KIND_INFO, formatPrice } from "@/lib/marketplace-catalog";

export const metadata: Metadata = { title: "Listing · McGill Martlet" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;

function loadClock(expiresAt: string) {
  const daysLeft = Math.ceil((Date.parse(expiresAt) - Date.now()) / DAY);
  return { daysLeft, expired: daysLeft <= 0, canRenew: daysLeft <= 7 };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ buyer?: string }> }) {
  const { id } = await params;
  const { buyer } = await searchParams;
  if (!UUID.test(id)) notFound();
  const result = await getListing(id);
  if (!result) {
    if (isMarketplacePreview()) notFound();
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <MartletNav />
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
          <h1 className="text-2xl font-extrabold">Listing not available</h1>
          <p className="mt-2 text-ink-muted">It may have been sold or removed, or you need to <Link href={`/login?next=/marketplace/${id}`} className="font-bold text-brand-ink underline">sign in</Link>.</p>
          <Link href="/marketplace" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Back to the marketplace</Link>
        </main>
      </div>
    );
  }
  const { listing, threads } = result;
  const preview = isMarketplacePreview();
  const { daysLeft, expired, canRenew } = loadClock(listing.expires_at);
  const open = (listing.status === "active" || listing.status === "reserved") && !expired;
  const category = CATEGORY_INFO[listing.category];
  const activeBuyer = listing.is_mine ? (threads.find((t) => t.buyer_id === buyer) ?? threads[0] ?? null) : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href={listing.is_mine ? "/marketplace?view=mine" : "/marketplace"} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Marketplace</Link>
        <article className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {listing.photos.length > 0 ? (
            <div className={`grid gap-1 bg-surface-muted ${listing.photos.length > 1 ? "grid-cols-2" : ""}`}>
              {listing.photos.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="focus-visible:outline-2 focus-visible:outline-focus">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket */}
                  <img src={url} alt={`${listing.title}, photo ${i + 1} of ${listing.photos.length}`} className={`w-full object-cover ${listing.photos.length > 1 ? "aspect-square" : "max-h-[28rem] object-contain"}`} />
                </a>
              ))}
            </div>
          ) : <div aria-hidden="true" className="grid h-40 place-items-center bg-surface-muted text-6xl">{category.emoji}</div>}

          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink-strong">{KIND_INFO[listing.kind].label}</span>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-2">{category.emoji} {category.label}</span>
              {listing.course_code && <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-2">{listing.course_code}</span>}
              <StatusBadge status={listing.status} />
              {expired && <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-ink-2 ring-1 ring-line-strong">Expired</span>}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight [overflow-wrap:anywhere]">{listing.title}</h1>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{formatPrice(listing.price_cents, listing.kind)}</p>

            <dl className="mt-5 grid gap-3 rounded-xl bg-canvas p-4 text-sm sm:grid-cols-2">
              <div><dt className="flex items-center gap-1.5 font-bold"><UserRound aria-hidden="true" size={16} className="text-brand-ink" /> {listing.kind === "wanted" ? "Asked by" : "Seller"}</dt><dd className="text-ink-2">{listing.is_mine ? "You" : listing.seller_name}</dd></div>
              <div><dt className="flex items-center gap-1.5 font-bold"><MapPin aria-hidden="true" size={16} className="text-brand-ink" /> Meet at</dt><dd className="text-ink-2">{listing.meet_location_name}</dd></div>
              {listing.condition && <div><dt className="font-bold">Condition</dt><dd className="text-ink-2">{CONDITION_LABELS[listing.condition]}</dd></div>}
              <div><dt className="flex items-center gap-1.5 font-bold"><Clock aria-hidden="true" size={16} className="text-brand-ink" /> Listed</dt><dd className="text-ink-2">{expired ? "Expired" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}</dd></div>
            </dl>

            {listing.description && <p className="mt-5 leading-7 whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{listing.description}</p>}
            {listing.status === "hidden" && listing.is_mine && <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">Several students reported this listing, so it’s hidden until a moderator reviews it.</p>}
            {listing.is_mine && <SellerControls id={listing.id} status={listing.status} canRenew={canRenew && (listing.status === "active" || listing.status === "reserved")} />}
            {!listing.is_mine && !preview && <div className="mt-4"><ReportButton type="listing" id={listing.id} /></div>}

            <section aria-labelledby="messages-heading" className="mt-6 border-t border-line pt-6">
              <h2 id="messages-heading" className="flex items-center gap-2 text-lg font-bold"><MessagesSquare aria-hidden="true" size={19} className="text-brand-ink" /> Messages</h2>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted"><ShieldCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0" /> Private between you and the {listing.is_mine ? "buyer" : "seller"}. Agree on a time at {listing.meet_location_name}; never pay in advance.</p>
              <div className="mt-4">
                {preview ? (
                  <p className="text-sm text-ink-muted">Messaging needs Supabase. This is a preview.</p>
                ) : listing.is_mine ? (
                  threads.length === 0 ? <p className="text-sm text-ink-muted">No messages yet. Interested students will message you here.</p> : (
                    <>
                      {threads.length > 1 && (
                        <nav aria-label="Conversations" className="mb-4 flex flex-wrap gap-2">
                          {threads.map((t) => (
                            <Link key={t.buyer_id} href={`/marketplace/${listing.id}?buyer=${t.buyer_id}`} aria-current={t === activeBuyer ? "true" : undefined}
                              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${t === activeBuyer ? "border-brand bg-brand text-on-brand" : "border-line-strong text-ink-2 hover:border-brand"}`}>
                              {t.buyer_name}
                            </Link>
                          ))}
                        </nav>
                      )}
                      {activeBuyer && <MessageThread key={activeBuyer.buyer_id} listingId={listing.id} thread={activeBuyer} buyerId={activeBuyer.buyer_id} otherName={activeBuyer.buyer_name} canSend={open} />}
                    </>
                  )
                ) : (
                  <MessageThread listingId={listing.id} thread={threads[0] ?? null} buyerId={null} otherName={listing.seller_name} canSend={open} />
                )}
                {!open && !preview && <p className="mt-3 text-sm text-ink-muted">This listing isn’t open any more, so new messages are off.</p>}
              </div>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
