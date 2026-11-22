import type { Metadata } from "next";
import { MartletNav } from "@/components/layout/MartletNav";
import { GuideBrowser } from "@/components/guide/GuideBrowser";

export const metadata: Metadata = { title: "Student guide · McGill Martlet" };

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Student guide</h1>
        <p className="mt-2 text-ink-muted">
          Step-by-step how-tos and quick tips for life at McGill. For dates, fees and rules, the linked official page always wins.
        </p>
        <GuideBrowser />
      </main>
    </div>
  );
}
