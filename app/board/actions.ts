"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  POSTABLE_KINDS, BoardError, REPORT_REASONS, acceptBoardAnswer, addBoardComment, createBoardPost, moderateContent,
  removeMyBoardContent, REPORT_TARGETS, reportContent, setBoardVote, type BoardKind, type PostableKind, type ReportReason, type ReportTarget,
} from "@/lib/board";
import { AuthRequiredError } from "@/lib/supabase/auth";
import { blockAuthor, unblockUser } from "@/lib/blocks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE = 3_000_000;
export type FormState = { error?: string; fields?: Record<string, string> };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
function friendly(error: unknown): string {
  if (error instanceof BoardError) return error.message;
  if (error instanceof AuthRequiredError) return "Sign in to do that.";
  console.error("Board action failed", error);
  return "Something went wrong. Try again.";
}

export async function createPostAction(_: FormState, form: FormData): Promise<FormState> {
  const kind = str(form.get("kind")) as BoardKind;
  const title = str(form.get("title")).trim();
  const body = str(form.get("body")).trim();
  const link = str(form.get("link")).trim();
  const tags = [...new Set(str(form.get("tags")).split(",").map((t) => t.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "")).filter(Boolean))].slice(0, 5);
  const fields = { kind, title, body, link, tags: tags.join(", ") };

  if (!POSTABLE_KINDS.includes(kind as PostableKind)) return { error: "Pick what kind of post this is.", fields };
  if (title.length < 3 || title.length > 120) return { error: "The title needs 3 to 120 characters.", fields };
  if (body.length > 2000) return { error: "Keep the text under 2000 characters.", fields };
  if (link && !/^https:\/\/\S+$/.test(link)) return { error: "Links must start with https://", fields };

  let image: Uint8Array | null = null;
  const file = form.get("image");
  if (file instanceof Blob && file.size > 0) {
    if (file.size > MAX_IMAGE) return { error: "The image is too large.", fields };
    image = new Uint8Array(await file.arrayBuffer());
    if (!(image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff)) return { error: "The image must be a JPEG.", fields };
  }
  if (kind === "meme" && !image && !body) return { error: "A meme needs an image or some text.", fields };

  let id: string;
  try {
    id = await createBoardPost({ kind, title, body, link, tags, image });
  } catch (error) {
    return { error: friendly(error), fields };
  }
  revalidatePath("/board");
  redirect(`/board/${id}`);
}

export async function commentAction(postId: string, _: FormState, form: FormData): Promise<FormState> {
  const body = str(form.get("body")).trim();
  if (!UUID.test(postId)) return { error: "That post isn't available." };
  if (!body || body.length > 1000) return { error: "Write 1 to 1000 characters.", fields: { body } };
  try { await addBoardComment(postId, body); } catch (error) { return { error: friendly(error), fields: { body } }; }
  revalidatePath(`/board/${postId}`);
  return {};
}

export async function voteAction(postId: string, on: boolean): Promise<string | null> {
  if (!UUID.test(postId)) return "That post isn't available.";
  try { await setBoardVote(postId, on); } catch (error) { return friendly(error); }
  revalidatePath("/board");
  return null;
}

export async function acceptAction(postId: string, commentId: string | null): Promise<void> {
  if (!UUID.test(postId) || (commentId !== null && !UUID.test(commentId))) return;
  await acceptBoardAnswer(postId, commentId).catch((e) => console.error(e));
  revalidatePath(`/board/${postId}`);
}

export async function removeAction(type: "post" | "comment", id: string, postId: string): Promise<void> {
  if (!UUID.test(id) || (type !== "post" && type !== "comment")) return;
  await removeMyBoardContent(type, id).catch((e) => console.error(e));
  revalidatePath("/board");
  if (type === "post") redirect("/board");
  revalidatePath(`/board/${postId}`);
}

export async function reportAction(type: ReportTarget, id: string, reason: string, note: string): Promise<string> {
  if (!UUID.test(id) || !REPORT_TARGETS.includes(type) || !(reason in REPORT_REASONS)) return "Couldn't send that report.";
  try {
    const r = await reportContent(type, id, reason as ReportReason, note.slice(0, 300));
    if (r === "already") return "You've already reported this. Thanks!";
    return r === "hidden" ? "Thanks. Enough people reported this, so it's hidden until a moderator reviews it." : "Thanks. A moderator will review it.";
  } catch (error) {
    return friendly(error);
  }
}

/** Blocks the author of an item (ADR 0051): they can't message you, and you stop seeing their posts. */
export async function blockAction(type: ReportTarget, id: string): Promise<string> {
  if (!UUID.test(id) || !REPORT_TARGETS.includes(type)) return "Couldn't block this person.";
  try {
    const r = await blockAuthor(type, id);
    revalidatePath("/", "layout");
    if (r === "self") return "That's you!";
    if (r === "missing") return "Couldn't find who wrote this.";
    return r === "already"
      ? "You've already blocked this person."
      : "Blocked. They can't message you, and you won't see their posts, comments, listings or chat. Unblock them from your profile.";
  } catch (error) {
    return friendly(error);
  }
}

/** Unblock someone from your blocked list on the profile page. */
export async function unblockAction(userId: string): Promise<void> {
  if (!UUID.test(userId)) return;
  await unblockUser(userId).catch((error) => console.error("Unblock failed", error));
  revalidatePath("/", "layout");
}

export async function moderateAction(type: ReportTarget, id: string, action: "restore" | "remove" | "dismiss"): Promise<void> {
  if (!UUID.test(id) || !REPORT_TARGETS.includes(type)) return;
  await moderateContent(type, id, action);
  revalidatePath("/moderation");
  revalidatePath("/board");
}
