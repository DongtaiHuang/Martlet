import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MartletNav } from "@/components/layout/MartletNav";
import { ModerationActions } from "@/components/board/ModerationActions";
import { REPORT_REASONS, isModerator, type ReportReason } from "@/lib/board";
import { listReviewQueue, type ReviewItem, type TargetType } from "@/lib/moderation";

export const metadata: Metadata = { title: "Moderation · Martlet" };
export const dynamic = "force-dynamic";
const tabs: { label: string; id: string }[] = [
  { label: "All reports", id: "all" },
  { label: "Campus Board", id: "board" },
  { label: "Meetups", id: "meetup" },
  { label: "Landmark photos", id: "landmark_photo" },
];
function href(type: TargetType, id: string, landmarkId: string) {
  if (type === "post") return `/board/${id}`;
  if (type === "meetup") return `/meetups/${id}`;
  if (type === "landmark_photo") return `/landmarks/${landmarkId}`;
  return null;
}
function filtered(reports: ReviewItem[], tab: string) {
  if (tab === "board") return reports.filter(x => x.type === "post" || x.type === "comment");
  if (tab === "meetup" || tab === "landmark_photo") return reports.filter(x => x.type === tab);
  return reports;
}
export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await isModerator())) notFound();
  const sp = await searchParams;
  const tab = tabs.some(t=>t.id === sp.tab) ? sp.tab ?? "all" : "all";
  const reports = await listReviewQueue();
  const showing = filtered(reports,tab);
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">Moderation</h1>
        <p className="mt-2 text-ink-muted">Review community reports for posts, comments, meetups and landmark photos. Three unique reports hide an item pending review.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[{label:"Pending reviews",value:reports.length},{label:"Board",value:reports.filter(r=>r.type==="post"||r.type==="comment").length},{label:"Meetups",value:reports.filter(r=>r.type==="meetup").length},{label:"Photos",value:reports.filter(r=>r.type==="landmark_photo").length}].map(x=>
            <div key={x.label} className="rounded-xl border border-line bg-surface p-3"><p className="text-xs text-ink-muted">{x.label}</p><p className="text-2xl font-bold">{x.value}</p></div>)}
        </div>
        <nav aria-label="Report type" className="mt-5 flex flex-wrap gap-2">
          {tabs.map(item => <Link key={item.id} href={item.id==="all"?"/moderation":`/moderation?tab=${item.id}`}
            aria-current={tab===item.id?"page":undefined}
            className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold ${tab===item.id?"border-brand bg-brand text-on-brand":"border-line-strong bg-surface hover:border-brand"}`}>{item.label}</Link>)}
        </nav>
        {showing.length === 0 ? (
          <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-ink-muted">No open reports in this section. 🎉</p>
        ) : (
          <ul className="mt-6 grid gap-4">
            {showing.map(r=>{
              const url=href(r.type,r.id,r.landmarkId);
              return <li key={`${r.type}:${r.id}:${r.landmarkId}`} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <p className="eyebrow text-ink-muted">{r.type.replace("_"," ")} · {r.count} {r.count===1?"report":"reports"} · {r.status}</p>
                <p className="mt-2 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{r.preview}</p>
                <p className="mt-2 text-sm text-ink-2"><strong>Reasons:</strong> {r.reasons.map(x=>REPORT_REASONS[x as ReportReason]??x).join(", ")}</p>
                {r.notes.length > 0 && <div className="mt-2 rounded-xl bg-surface-muted p-3"><p className="text-xs font-semibold">Private report notes</p><ul className="mt-1 list-disc pl-4 text-sm text-ink-muted">{r.notes.map((note,i)=><li key={i}>{note}</li>)}</ul></div>}
                <div className="mt-2 flex flex-wrap gap-2">{url && <Link href={url} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-ink underline">View context</Link>}</div>
                <ModerationActions type={r.type} id={r.id} landmarkId={r.landmarkId}/>
              </li>;
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
