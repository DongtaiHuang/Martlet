import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, ShieldCheck } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { isMarketplacePreview, listListings } from "@/lib/marketplace";
import { CATEGORY_INFO, KIND_INFO, LISTING_CATEGORIES, LISTING_KINDS, type ListingCategory, type ListingKind } from "@/lib/marketplace-catalog";

export const metadata: Metadata = { title: "Marketplace · McGill Martlet" };
export const dynamic = "force-dynamic";

const chip = (on: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${on ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink-2 hover:border-brand"}`;

type Params = { category?: string; kind?: string; q?: string; view?: string };

function href(current: Params, change: Params) {
  const next = { ...current, ...change };
  const query = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])));
  const text = query.toString();
  return text ? `/marketplace?${text}` : "/marketplace";
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const category = LISTING_CATEGORIES.includes(params.category as ListingCategory) ? (params.category as ListingCategory) : undefined;
  const kind = LISTING_KINDS.includes(params.kind as ListingKind) ? (params.kind as ListingKind) : undefined;
  const mine = params.view === "mine";
  const q = (params.q ?? "").slice(0, 60);
  const current: Params = { category, kind, q: q || undefined, view: mine ? "mine" : undefined };
  const listings = await listListings({ category, kind, q, mine });
  const preview = isMarketplacePreview();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Marketplace</h1>
            <p className="mt-2 text-ink-muted">Buy, sell, swap or give away things with other McGill students. Martlet never handles money: you meet on campus and pay in person.</p>
          </div>
          {!preview && listings !== null && (
            <Link href="/marketplace/new" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              <Plus aria-hidden="true" size={16} /> Post a listing
            </Link>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">
          <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>Meet in a public campus building during the day, check the item before paying, and never send money or banking details in advance.</span>
        </p>
        {preview && <p className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm text-ink-muted">Preview mode: these are sample listings. Connect Supabase to post and message sellers.</p>}

        {listings === null ? (
          <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="font-semibold">The marketplace is for signed-in McGill students.</p>
            <Link href="/login?next=/marketplace" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-focus">Sign in</Link>
          </div>
        ) : (
          <>
            <nav aria-label="Listings" className="mt-6 flex flex-wrap gap-2">
              <Link href={href(current, { view: undefined })} aria-current={!mine ? "page" : undefined} className={chip(!mine)}>All listings</Link>
              {!preview && <Link href={href(current, { view: "mine" })} aria-current={mine ? "page" : undefined} className={chip(mine)}>Your listings</Link>}
            </nav>

            <form action="/marketplace" className="mt-4 flex flex-wrap gap-2" role="search">
              {mine && <input type="hidden" name="view" value="mine" />}
              {category && <input type="hidden" name="category" value={category} />}
              <label className="relative min-w-0 flex-1 basis-60">
                <span className="sr-only">Search listings</span>
                <Search aria-hidden="true" size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
                <input name="q" defaultValue={q} maxLength={60} placeholder="Search: calculator, COMP 250, desk…" className="min-h-11 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-9 text-ink focus-visible:outline-2 focus-visible:outline-focus" />
              </label>
              <label>
                <span className="sr-only">Type</span>
                <select name="kind" defaultValue={kind ?? ""} className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-focus">
                  <option value="">Any type</option>
                  {LISTING_KINDS.map((k) => <option key={k} value={k}>{KIND_INFO[k].label}</option>)}
                </select>
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:border-brand focus-visible:outline-2 focus-visible:outline-focus">Search</button>
            </form>

            <nav aria-label="Categories" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <Link href={href(current, { category: undefined })} aria-current={!category ? "page" : undefined} className={`${chip(!category)} shrink-0`}>All</Link>
              {LISTING_CATEGORIES.map((c) => (
                <Link key={c} href={href(current, { category: c })} aria-current={category === c ? "page" : undefined} className={`${chip(category === c)} shrink-0`}>
                  <span aria-hidden="true">{CATEGORY_INFO[c].emoji}</span>{CATEGORY_INFO[c].label}
                </Link>
              ))}
            </nav>

            {listings.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center text-ink-muted">
                {mine ? "You haven’t listed anything yet." : q || category || kind ? "Nothing matches. Try another search or category." : "No listings yet. Be the first!"}
              </p>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
