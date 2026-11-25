import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { MultiTable } from "@/components/blackjack/MultiTable";
import { listTables, syncTable, TableError } from "@/lib/blackjack-tables";

export const metadata: Metadata = { title: "Blackjack table · McGill Martlet" };
export const dynamic = "force-dynamic";

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tables = await listTables();
  if (tables === null) redirect(`/login?next=${encodeURIComponent(`/play/blackjack/tables/${id}`)}`);
  const summary = tables.find((t) => t.id === id);
  if (!summary) notFound();
  let state;
  try {
    state = await syncTable(id);
  } catch (error) {
    if (error instanceof TableError) notFound();
    throw error;
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-4xl px-4 py-7 sm:px-8 sm:py-10">
        <Link href="/play/blackjack/tables" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> All tables</Link>
        <h1 className="mt-2 mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{summary.name}</h1>
        <MultiTable initial={state} />
        <p className="mt-3 text-center text-xs text-ink-muted">Martlet points have no cash value. 100 table hands a day.</p>
      </main>
    </div>
  );
}
