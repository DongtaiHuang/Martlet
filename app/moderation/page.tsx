import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MartletNav } from "@/components/layout/MartletNav";
import { ModerationActions } from "@/components/board/ModerationActions";
import { REPORT_REASONS, isModerator, listOpenReports, type ReportReason } from "@/lib/board";

export const metadata: Metadata = { title: "Moderation · McGill Martlet" };
export const dynamic = "force-dynamic";

/** Moderators only (profiles.is_moderator, set in Supabase). Everyone else gets a 404. */
export default async function ModerationPage() {
  if (!(await isModerator())) notFound();
  const reports = await listOpenReports();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">Moderation</h1>
        <p className="mt-2 text-ink-muted">Open reports, most-reported first. Content with 3 reports is already hidden. Restore it, remove it, or dismiss the reports.</p>
        {reports.length === 0 ? (
          <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-ink-muted">No open reports. 🎉</p>
        ) : (
          <ul className="mt-6 grid gap-4">
            {reports.map((r) => (
              <li key={`${r.target_type}-${r.target_id}`} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <p className="eyebrow text-ink-muted">
                  {r.target_type} · {r.count} {r.count === 1 ? "report" : "reports"} · now {r.status}
                </p>
                <p className="mt-1 text-ink [overflow-wrap:anywhere]">{r.preview}</p>
                <p className="mt-2 text-sm text-ink-2"><strong>Reasons:</strong> {r.reasons.map((x) => REPORT_REASONS[x as ReportReason] ?? x).join(", ")}</p>
                {r.notes.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
                <ModerationActions type={r.target_type} id={r.target_id} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
