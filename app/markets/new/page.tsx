import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { ProposeForm } from "@/components/markets/ProposeForm";

export const metadata: Metadata = { title: "Propose a market · McGill Martlet" };

export default function NewMarketPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-2xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/markets" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> All predictions</Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Propose a market</h1>
        <p className="mt-2 text-ink-muted">Ask a yes/no question about something happening on or around campus. Everyone forecasts it with Martlet points, which have no cash value.</p>
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
          <ProposeForm />
        </div>
      </main>
    </div>
  );
}
