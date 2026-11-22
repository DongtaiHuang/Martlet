import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { PostCard } from "@/components/board/PostCard";
import { AcceptButton, CommentForm, RemoveButton, ReportButton } from "@/components/board/BoardControls";
import { getBoardPost } from "@/lib/board";

export const metadata: Metadata = { title: "Post · McGill Martlet" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(iso));

export default async function BoardPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBoardPost(id);
  if (!data) notFound();
  const { post, comments } = data;
  const question = post.kind === "question";
  // Best answer first, then oldest first.
  const sorted = [...comments].sort((a, b) => Number(b.id === post.accepted_comment_id) - Number(a.id === post.accepted_comment_id));

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <Link href="/board" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Campus board</Link>
        <div className="mt-2"><PostCard post={post} full /></div>
        {post.is_mine && <div className="mt-1 flex justify-end"><RemoveButton type="post" id={post.id} postId={post.id} /></div>}

        <section aria-labelledby="comments-heading" className="mt-8">
          <h2 id="comments-heading" className="text-xl font-bold">{question ? "Answers" : "Comments"} <span className="font-semibold text-ink-subtle">({comments.length})</span></h2>
          {sorted.length === 0 && <p className="mt-2 text-sm text-ink-muted">{question ? "No answers yet. Know the answer?" : "No comments yet."}</p>}
          <ul className="mt-3 grid gap-3">
            {sorted.map((c) => {
              const accepted = c.id === post.accepted_comment_id;
              return (
                <li key={c.id} className={`rounded-xl border p-4 ${accepted ? "border-ok-line bg-ok-soft" : "border-line bg-surface"}`}>
                  <p className="eyebrow flex flex-wrap items-center gap-1.5 text-ink-muted">
                    {accepted && <span className="inline-flex items-center gap-1 text-ok-ink"><CheckCircle2 aria-hidden="true" size={13} /> Best answer</span>}
                    <span>{c.author_name}</span><span aria-hidden="true">·</span><time dateTime={c.created_at}>{when(c.created_at)}</time>
                    {c.status !== "visible" && <span className="rounded bg-warn-soft px-1.5 text-warn-ink">Hidden pending review</span>}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-ink-2 [overflow-wrap:anywhere]">{c.body}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                    {question && post.is_mine && !c.is_mine && <AcceptButton postId={post.id} commentId={c.id} accepted={accepted} />}
                    {c.is_mine ? <RemoveButton type="comment" id={c.id} postId={post.id} /> : <ReportButton type="comment" id={c.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {post.status === "visible" && <CommentForm postId={post.id} label={question ? "Your answer" : "Add a comment"} />}
        </section>
      </main>
    </div>
  );
}
