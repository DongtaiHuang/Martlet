import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { NewPostForm } from "@/components/board/NewPostForm";
import { POSTABLE_KINDS, type PostableKind } from "@/lib/board-catalog";

export const metadata: Metadata = { title: "New post · McGill Martlet" };

export default async function NewBoardPostPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
        <Link href="/board" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Campus board</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">New post</h1>
        <NewPostForm initialKind={POSTABLE_KINDS.includes(kind as PostableKind) ? (kind as PostableKind) : "meme"} />
      </main>
    </div>
  );
}
