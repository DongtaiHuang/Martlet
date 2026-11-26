import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { DISCIPLINE_INFO, REQUEST_STATUS_LABELS, formatBudget } from "@/lib/creator-catalog";
import { isCreatorPreview, listMyRequests, type CreatorRequest } from "@/lib/creators";

export const metadata: Metadata = { title: "Requests · McGill Martlet" };
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });

function RequestList({ requests, empty }: { requests: CreatorRequest[]; empty: string }) {
  if (!requests.length) return <p className="mt-2 text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="mt-3 grid gap-2">
      {requests.map((r) => {
        const other = r.i_am_creator ? r.client_name : r.creator_name;
        const live = r.status === "open" || r.status === "accepted";
        return (
          <li key={r.id} className="relative rounded-2xl border border-line bg-surface p-4 shadow-sm hover:border-line-strong">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                <Link href={`/creators/requests/${r.id}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-focus">
                  {DISCIPLINE_INFO[r.discipline].emoji} {DISCIPLINE_INFO[r.discipline].label} · {r.i_am_creator ? `from ${other}` : `to ${other}`}
                </Link>
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${live ? "bg-brand-soft text-brand-ink-strong ring-brand-line" : "bg-surface-muted text-ink-2 ring-line-strong"}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {formatBudget(r.budget_cents)}{r.needed_by ? ` · needed by ${dateFormat.format(new Date(`${r.needed_by}T12:00:00Z`))}` : ""} · last activity {dateFormat.format(new Date(r.updated_at))}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export default async function RequestsPage() {
  const preview = isCreatorPreview();
  const requests = preview ? null : await listMyRequests();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <Link href="/creators" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Creators</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Requests</h1>
        {requests === null ? (
          <p className="mt-6 rounded-2xl border border-line bg-surface p-6 text-ink-muted">
            {preview ? "Requests need Supabase. This is a preview." : <><Link href="/login?next=/creators/requests" className="font-bold text-brand-ink underline">Sign in</Link> to see your requests.</>}
          </p>
        ) : (
          <>
            <section aria-labelledby="received-heading" className="mt-6">
              <h2 id="received-heading" className="text-xl font-bold">Received</h2>
              <RequestList requests={requests.received} empty="No requests yet. Students who like your portfolio can send you one." />
            </section>
            <section aria-labelledby="sent-heading" className="mt-8">
              <h2 id="sent-heading" className="text-xl font-bold">Sent</h2>
              <RequestList requests={requests.sent} empty="You haven’t sent any requests. Find a creator to work with." />
            </section>
            <p className="mt-8 text-xs text-ink-muted">Declined and closed requests are deleted after 30 days, and any request after 6 months without activity.</p>
          </>
        )}
      </main>
    </div>
  );
}
