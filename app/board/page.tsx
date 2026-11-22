import type { Metadata } from "next";
import Link from "next/link";
import { PenSquare, ShieldCheck } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { PostCard } from "@/components/board/PostCard";
import { BOARD_KINDS, KIND_INFO, isModerator, listBoardPosts, type BoardKind, type BoardSort } from "@/lib/board";

export const metadata: Metadata = { title: "Campus board · McGill Martlet" };
export const dynamic = "force-dynamic";

const SORTS: { id: BoardSort; label: string }[] = [{ id: "hot", label: "Hot" }, { id: "new", label: "New" }, { id: "top", label: "Top" }];
const chip = (on: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${on ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink-2 hover:border-brand"}`;

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ kind?: string; sort?: string }> }) {
  const sp = await searchParams;
  const kind = BOARD_KINDS.includes(sp.kind as BoardKind) ? (sp.kind as BoardKind) : null;
  const sort: BoardSort = sp.sort === "new" || sp.sort === "top" ? sp.sort : "hot";
  const [posts, mod] = await Promise.all([listBoardPosts(kind, sort), isModerator()]);
  const href = (k: BoardKind | null, s: BoardSort) => `/board?${new URLSearchParams({ ...(k ? { kind: k } : {}), ...(s !== "hot" ? { sort: s } : {}) })}`;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Campus board</h1>
            <p className="mt-2 text-ink-muted">Memes, tips, questions and skills from McGill students.</p>
          </div>
          <div className="flex gap-2">
            {mod && <Link href="/moderation" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-bold text-ink-2 hover:border-brand"><ShieldCheck aria-hidden="true" size={16} /> Moderation</Link>}
            <Link href={`/board/new${kind ? `?kind=${kind}` : ""}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><PenSquare aria-hidden="true" size={16} /> New post</Link>
          </div>
        </div>

        <nav aria-label="Post types" className="mt-6 flex flex-wrap gap-2">
          <Link href={href(null, sort)} aria-current={!kind ? "page" : undefined} className={chip(!kind)}>All</Link>
          {BOARD_KINDS.map((k) => (
            <Link key={k} href={href(k, sort)} aria-current={kind === k ? "page" : undefined} className={chip(kind === k)}><span aria-hidden="true">{KIND_INFO[k].emoji}</span>{KIND_INFO[k].plural}</Link>
          ))}
        </nav>
        <nav aria-label="Sort" className="mt-3 flex gap-1 text-sm">
          {SORTS.map((s) => (
            <Link key={s.id} href={href(kind, s.id)} aria-current={sort === s.id ? "true" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 font-semibold ${sort === s.id ? "bg-surface-muted text-ink" : "text-ink-muted hover:text-ink"}`}>{s.label}</Link>
          ))}
        </nav>

        {posts === null ? (
          <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
            The board isn’t available right now. <Link href="/login?next=%2Fboard" className="font-semibold text-brand-ink underline">Sign in</Link> with your McGill email to read and post.
          </p>
        ) : posts.length === 0 ? (
          <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-ink-muted">Nothing here yet. <Link href={`/board/new${kind ? `?kind=${kind}` : ""}`} className="font-semibold text-brand-ink underline">Be the first to post</Link>.</p>
        ) : (
          <div className="mt-4 grid gap-4">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        )}
      </main>
    </div>
  );
}
