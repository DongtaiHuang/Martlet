import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Listing } from "@/lib/marketplace";
import { CATEGORY_INFO, CONDITION_LABELS, KIND_INFO, formatPrice } from "@/lib/marketplace-catalog";

export function StatusBadge({ status }: { status: Listing["status"] }) {
  if (status === "active") return null;
  const label = { reserved: "Reserved", sold: "Sold", hidden: "Hidden for review", removed: "Removed" }[status];
  return <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-ink-2 ring-1 ring-line-strong">{label}</span>;
}

export function ListingCard({ listing }: { listing: Listing }) {
  const category = CATEGORY_INFO[listing.category];
  return (
    <li className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:border-line-strong">
      {listing.photos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
        <img src={listing.photos[0]} alt="" loading="lazy" className="aspect-[4/3] w-full bg-surface-muted object-cover" />
      ) : (
        <div aria-hidden="true" className="grid aspect-[4/3] w-full place-items-center bg-surface-muted text-5xl">{category.emoji}</div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-extrabold tabular-nums text-ink">{formatPrice(listing.price_cents, listing.kind)}</p>
          <StatusBadge status={listing.status} />
        </div>
        <h2 className="text-sm font-bold leading-snug text-ink [overflow-wrap:anywhere]">
          <Link href={`/marketplace/${listing.id}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{listing.title}</Link>
        </h2>
        <p className="text-xs text-ink-muted">
          {KIND_INFO[listing.kind].label} · {category.label}{listing.condition ? ` · ${CONDITION_LABELS[listing.condition]}` : ""}{listing.course_code ? ` · ${listing.course_code}` : ""}
        </p>
        <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-ink-muted"><MapPin aria-hidden="true" size={13} /> {listing.meet_location_name}</p>
      </div>
    </li>
  );
}
