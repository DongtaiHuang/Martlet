import Link from "next/link";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { KIND_INFO } from "@/lib/board-catalog";
import type { BoardPost } from "@/lib/board";
import { ReportButton, VoteButton } from "./BoardControls";

const when = (iso: string) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(iso));

/** One board post in the list (full=false) or on its own page (full=true). */
export function PostCard({ post, full = false }: { post: BoardPost; full?: boolean }) {
  const info = KIND_INFO[post.kind];
  const Title = full ? "h1" : "h2";
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <p className="eyebrow flex flex-wrap items-center gap-x-1.5 text-ink-muted">
        <span className="text-brand-ink">{info.emoji} {info.label}</span><span aria-hidden="true">·</span>
        <span>{post.author_name}</span><span aria-hidden="true">·</span><time dateTime={post.created_at}>{when(post.created_at)}</time>
        {post.status !== "visible" && <span className="rounded bg-warn-soft px-1.5 text-warn-ink">Hidden pending review</span>}
      </p>
      <Title className={`mt-1.5 font-semibold leading-snug text-ink [overflow-wrap:anywhere] ${full ? "text-2xl sm:text-3xl" : "text-xl"}`}>
        {full ? post.title : <Link href={`/board/${post.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-focus">{post.title}</Link>}
      </Title>
      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
        <img src={post.image_url} alt={`Image for: ${post.title}`} loading="lazy" className="mt-3 max-h-[28rem] w-full rounded-xl bg-surface-muted object-contain" />
      )}
      {post.body && <p className={`mt-2 whitespace-pre-line text-ink-2 [overflow-wrap:anywhere] ${full ? "" : "line-clamp-4"}`}>{post.body}</p>}
      {post.link && (
        <a href={post.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2 inline-block max-w-full truncate text-sm font-semibold text-brand-ink underline">{post.link.replace(/^https:\/\//, "")}</a>
      )}
      {post.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {post.tags.map((t) => <li key={t} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-2">#{t}</li>)}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
        <VoteButton postId={post.id} votes={post.votes} voted={post.has_voted} />
        {!full && (
          <Link href={`/board/${post.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-ink-2 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus">
            <MessageCircle aria-hidden="true" size={16} /> {post.comments} {post.kind === "question" ? (post.comments === 1 ? "answer" : "answers") : (post.comments === 1 ? "comment" : "comments")}
          </Link>
        )}
        {post.kind === "question" && post.accepted_comment_id && <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok-ink"><CheckCircle2 aria-hidden="true" size={14} /> Answered</span>}
        {post.kind === "skill" && (
          <Link href={`/meetups/new?category=skills&title=${encodeURIComponent(`Skillshare: ${post.title}`.slice(0, 80))}`} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-brand-ink hover:underline">Host it as a meetup</Link>
        )}
        <span className="ml-auto">{!post.is_mine && <ReportButton type="post" id={post.id} />}</span>
      </div>
    </article>
  );
}
