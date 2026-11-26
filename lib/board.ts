// Community board + moderation (ADR 0027). Components call these, not Supabase directly.
// Writes go through migration 017's RPCs, which take the user from the session and rate-limit.
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { BOARD_KINDS, KIND_INFO, REPORT_REASONS, type BoardKind, type ReportReason } from "@/lib/board-catalog";

export { BOARD_KINDS, KIND_INFO, REPORT_REASONS, type BoardKind, type ReportReason };
export type BoardSort = "hot" | "new" | "top";

export type BoardPost = {
  id: string; kind: BoardKind; title: string; body: string; link: string; tags: string[];
  status: "visible" | "hidden" | "removed"; created_at: string; author_id: string; author_name: string;
  votes: number; comments: number; has_voted: boolean; is_mine: boolean; image_url: string | null;
  accepted_comment_id: string | null;
};
export type BoardComment = { id: string; body: string; created_at: string; author_name: string; is_mine: boolean; status: string };
export const REPORT_TARGETS = ["post", "comment", "photo", "listing", "listing_message"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type OpenReport = { target_type: ReportTarget; target_id: string; reasons: string[]; notes: string[]; count: number; first_at: string; preview: string; status: string; image_url?: string };

export class BoardError extends Error {}

const BUCKET = "board-images";
// board_comments links to board_posts twice (post_id and accepted_comment_id): name the FK.
const POST_SELECT = "id, kind, title, body, link, tags, status, created_at, author_id, has_image, accepted_comment_id, author:profiles!author_id(display_name), votes:board_votes(count), comments:board_comments!board_comments_post_id_fkey(count)";
type Row = Omit<BoardPost, "author_name" | "votes" | "comments" | "has_voted" | "is_mine" | "image_url"> & {
  has_image: boolean;
  author: { display_name: string } | { display_name: string }[] | null;
  votes: { count: number }[] | null; comments: { count: number }[] | null;
};

const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

async function session() {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return userId ? { supabase, userId } : null;
}

async function toPosts(s: NonNullable<Awaited<ReturnType<typeof session>>>, rows: Row[]): Promise<BoardPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const imagePaths = rows.filter((r) => r.has_image).map((r) => `${r.author_id}/${r.id}.jpg`);
  const [mine, signed] = await Promise.all([
    s.supabase.from("board_votes").select("post_id").eq("user_id", s.userId).in("post_id", ids),
    imagePaths.length ? s.supabase.storage.from(BUCKET).createSignedUrls(imagePaths, 3600) : Promise.resolve({ data: [], error: null }),
  ]);
  const voted = new Set((mine.data ?? []).map((v) => v.post_id as string));
  const urls = new Map((signed.data ?? []).filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl]));
  return rows.map(({ author, votes, comments, has_image, ...r }) => ({
    ...r,
    author_name: first(author)?.display_name ?? "Martlet Student",
    votes: votes?.[0]?.count ?? 0,
    comments: comments?.[0]?.count ?? 0,
    has_voted: voted.has(r.id),
    is_mine: r.author_id === s.userId,
    image_url: has_image ? urls.get(`${r.author_id}/${r.id}.jpg`) ?? null : null,
  }));
}

/** Visible posts, filtered and sorted. null when signed out or not set up (migration 017). */
export async function listBoardPosts(kind: BoardKind | null, sort: BoardSort): Promise<BoardPost[] | null> {
  const s = await session();
  if (!s) return null;
  let q = s.supabase.from("board_posts").select(POST_SELECT).eq("status", "visible").order("created_at", { ascending: false }).limit(100);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q.returns<Row[]>();
  if (error) { console.warn("listBoardPosts failed", error.message); return null; }
  const posts = await toPosts(s, data);
  const now = Date.now();
  // Hot: votes decay with age (hours), so fresh posts get a chance.
  const hot = (p: BoardPost) => (p.votes + 1) / Math.pow((now - Date.parse(p.created_at)) / 3_600_000 + 2, 1.5);
  if (sort === "top") posts.sort((a, b) => b.votes - a.votes || b.created_at.localeCompare(a.created_at));
  if (sort === "hot") posts.sort((a, b) => hot(b) - hot(a));
  return posts;
}

export async function getBoardPost(id: string): Promise<{ post: BoardPost; comments: BoardComment[] } | null> {
  const s = await session();
  if (!s || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [post, comments] = await Promise.all([
    s.supabase.from("board_posts").select(POST_SELECT).eq("id", id).maybeSingle<Row>(),
    s.supabase.from("board_comments").select("id, body, created_at, status, author_id, author:profiles!author_id(display_name)").eq("post_id", id).neq("status", "removed").order("created_at"),
  ]);
  if (post.error || !post.data || post.data.status === "removed") return null;
  const [full] = await toPosts(s, [post.data]);
  return {
    post: full,
    comments: (comments.data ?? []).map((c) => ({
      id: c.id as string, body: c.body as string, created_at: c.created_at as string, status: c.status as string,
      author_name: first(c.author as unknown as { display_name: string } | { display_name: string }[] | null)?.display_name ?? "Martlet Student", is_mine: c.author_id === s.userId,
    })),
  };
}

function rpcError(error: { message: string; hint?: string; code?: string }): never {
  if (error.hint === "rate-limit") throw new BoardError("You're posting a lot! Take a short break and try again later.");
  if (error.code === "23514") throw new BoardError("Check the form: something is too long or missing.");
  if (error.code === "P0002") throw new BoardError("That post isn't available any more.");
  throw new Error(error.message);
}

export async function createBoardPost(input: { kind: BoardKind; title: string; body: string; link: string; tags: string[]; image: Uint8Array | null }): Promise<string> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_board_post", {
    p_kind: input.kind, p_title: input.title, p_body: input.body, p_link: input.link, p_tags: input.tags, p_has_image: Boolean(input.image),
  });
  if (error) rpcError(error);
  const id = data as string;
  if (input.image) {
    const up = await supabase.storage.from(BUCKET).upload(`${user.id}/${id}.jpg`, input.image, { contentType: "image/jpeg" });
    if (up.error) {
      console.error("Board image upload failed", up.error);
      await supabase.rpc("remove_my_board_content", { p_type: "post", p_id: id });
      throw new BoardError("The image didn't upload, so the post wasn't published. Try again.");
    }
  }
  return id;
}

export async function addBoardComment(postId: string, body: string) {
  await requireUser();
  const { error } = await (await createClient()).rpc("create_board_comment", { p_post: postId, p_body: body });
  if (error) rpcError(error);
}

export async function setBoardVote(postId: string, on: boolean) {
  await requireUser();
  const { error } = await (await createClient()).rpc("set_board_vote", { p_post: postId, p_on: on });
  if (error) rpcError(error);
}

export async function acceptBoardAnswer(postId: string, commentId: string | null) {
  await requireUser();
  const { error } = await (await createClient()).rpc("accept_board_answer", { p_post: postId, p_comment: commentId });
  if (error) rpcError(error);
}

export async function removeMyBoardContent(type: "post" | "comment", id: string) {
  await requireUser();
  const { error } = await (await createClient()).rpc("remove_my_board_content", { p_type: type, p_id: id });
  if (error) rpcError(error);
}

export async function reportContent(type: ReportTarget, id: string, reason: ReportReason, note: string): Promise<"reported" | "hidden" | "already"> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc("report_content", { p_type: type, p_id: id, p_reason: reason, p_note: note });
  if (error) rpcError(error);
  return data as "reported" | "hidden" | "already";
}

// Moderation -------------------------------------------------------------------------------
export async function isModerator(): Promise<boolean> {
  const s = await session();
  if (!s) return false;
  const { data } = await s.supabase.rpc("is_moderator");
  return data === true;
}

/** Open reports grouped by item (moderators only; RLS returns nothing to others). */
export async function listOpenReports(): Promise<OpenReport[]> {
  const s = await session();
  if (!s) return [];
  const { data, error } = await s.supabase.from("content_reports").select("target_type, target_id, reason, note, created_at").is("resolved_at", null).order("created_at");
  if (error || !data) return [];
  const groups = new Map<string, OpenReport>();
  for (const r of data) {
    const key = `${r.target_type}:${r.target_id}`;
    const g: OpenReport = groups.get(key) ?? { target_type: r.target_type, target_id: r.target_id, reasons: [], notes: [], count: 0, first_at: r.created_at, preview: "", status: "" };
    g.count += 1; if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason); if (r.note) g.notes.push(r.note);
    groups.set(key, g);
  }
  const list = [...groups.values()];
  const postIds = list.filter((g) => g.target_type === "post").map((g) => g.target_id);
  const commentIds = list.filter((g) => g.target_type === "comment").map((g) => g.target_id);
  const photoIds = list.filter((g) => g.target_type === "photo").map((g) => g.target_id);
  const [posts, comments, photos] = await Promise.all([
    postIds.length ? s.supabase.from("board_posts").select("id, title, body, status").in("id", postIds) : Promise.resolve({ data: [] }),
    commentIds.length ? s.supabase.from("board_comments").select("id, body, status").in("id", commentIds) : Promise.resolve({ data: [] }),
    photoIds.length ? s.supabase.from("meetup_photos").select("id, meetup_id, status, meetup:meetups(title)").in("id", photoIds) : Promise.resolve({ data: [] }),
  ]);
  const listingIds = list.filter((g) => g.target_type === "listing").map((g) => g.target_id);
  const messageIds = list.filter((g) => g.target_type === "listing_message").map((g) => g.target_id);
  const [listings, messages] = await Promise.all([
    listingIds.length ? s.supabase.from("listings").select("id, title, description, status").in("id", listingIds) : Promise.resolve({ data: [] }),
    messageIds.length ? s.supabase.from("listing_messages").select("id, body, status").in("id", messageIds) : Promise.resolve({ data: [] }),
  ]);
  const byId = new Map<string, { preview: string; status: string; image_url?: string }>();
  // Meetup photos (ADR 0039): RLS shows moderators live photos only; closed albums read as deleted.
  const photoRows = (photos.data ?? []) as { id: string; meetup_id: string; status: string; meetup: { title: string } | { title: string }[] | null }[];
  if (photoRows.length) {
    const { data: urls } = await s.supabase.storage.from("meetup-photos").createSignedUrls(photoRows.map((p) => `${p.meetup_id}/${p.id}.jpg`), 600);
    photoRows.forEach((p, i) => {
      const meetup = first(p.meetup);
      byId.set(p.id, { preview: `Photo in the meetup “${meetup?.title ?? "unknown"}”`, status: p.status, image_url: urls?.[i]?.signedUrl ?? undefined });
    });
  }
  for (const p of (posts.data ?? []) as { id: string; title: string; body: string; status: string }[]) byId.set(p.id, { preview: `${p.title} — ${p.body}`.slice(0, 240), status: p.status });
  for (const c of (comments.data ?? []) as { id: string; body: string; status: string }[]) byId.set(c.id, { preview: c.body.slice(0, 240), status: c.status });
  for (const l of (listings.data ?? []) as { id: string; title: string; description: string; status: string }[]) byId.set(l.id, { preview: `${l.title} — ${l.description}`.slice(0, 240), status: l.status });
  for (const m of (messages.data ?? []) as { id: string; body: string; status: string }[]) byId.set(m.id, { preview: `Private message: ${m.body}`.slice(0, 240), status: m.status });
  return list.map((g) => ({ ...g, ...(byId.get(g.target_id) ?? { preview: "(deleted)", status: "removed" }) })).sort((a, b) => b.count - a.count);
}

export async function moderateContent(type: ReportTarget, id: string, action: "restore" | "remove" | "dismiss") {
  await requireUser();
  const { error } = await (await createClient()).rpc("moderate_content", { p_type: type, p_id: id, p_action: action });
  if (error) rpcError(error);
}
