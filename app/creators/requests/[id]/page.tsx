import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { RequestStatusControls, RequestThread } from "@/components/creators/RequestControls";
import { MartletNav } from "@/components/layout/MartletNav";
import { DISCIPLINE_INFO, REQUEST_STATUS_LABELS, formatBudget } from "@/lib/creator-catalog";
import { getCreatorRequest } from "@/lib/creators";

export const metadata: Metadata = { title: "Request · McGill Martlet" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const result = await getCreatorRequest(id);
  if (!result) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <MartletNav />
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
          <h1 className="text-2xl font-extrabold">Request not available</h1>
          <p className="mt-2 text-ink-muted">It may have been deleted, or you need to <Link href={`/login?next=/creators/requests/${id}`} className="font-bold text-brand-ink underline">sign in</Link>.</p>
          <Link href="/creators/requests" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Your requests</Link>
        </main>
      </div>
    );
  }
  const { request, messages } = result;
  const other = request.i_am_creator ? request.client_name : request.creator_name;
  const discipline = DISCIPLINE_INFO[request.discipline];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/creators/requests" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Your requests</Link>
        <article className="mt-3 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-2">{discipline.emoji} {discipline.label}</span>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-ink-strong">{REQUEST_STATUS_LABELS[request.status]}</span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
            {request.i_am_creator ? <>Request from {other}</> : <>Your request to <Link href={`/creators/${request.creator_id}`} className="text-brand-ink underline">{other}</Link></>}
          </h1>
          <dl className="mt-4 grid gap-3 rounded-xl bg-canvas p-4 text-sm sm:grid-cols-2">
            <div><dt className="font-bold">Budget</dt><dd className="text-ink-2">{formatBudget(request.budget_cents)}</dd></div>
            <div><dt className="font-bold">Needed by</dt><dd className="text-ink-2">{request.needed_by ? dateFormat.format(new Date(`${request.needed_by}T12:00:00Z`)) : "No date"}</dd></div>
          </dl>
          <div className="mt-4"><RequestStatusControls request={request} /></div>

          <section aria-labelledby="thread-heading" className="mt-6 border-t border-line pt-6">
            <h2 id="thread-heading" className="text-lg font-bold">Messages</h2>
            <p className="mt-1 mb-4 flex items-start gap-1.5 text-sm text-ink-muted"><ShieldCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0" /> Private between you and {other}. Meet on campus, agree on the price before starting, and never pay in full in advance.</p>
            <RequestThread request={request} messages={messages} otherName={other} />
          </section>
        </article>
      </main>
    </div>
  );
}
