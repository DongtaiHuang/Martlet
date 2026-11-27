// Blocking (ADR 0051). Components call these, not Supabase directly. You block "the author of
// this item" (the same item types as reports), so user ids never need to reach the browser.
// Messaging between blocked pairs is refused by the database (migration 035); hiding blocked
// students' posts, comments, listings and creator profiles is done in the list queries.
import type { ReportTarget } from "@/lib/board";
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type BlockResult = "blocked" | "already" | "self" | "missing";
export type BlockedPerson = { user_id: string; name: string; created_at: string };

export async function blockAuthor(type: ReportTarget, id: string): Promise<BlockResult> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc("block_author", { p_type: type, p_id: id });
  if (error) throw new Error(error.hint === "block-limit" ? "You've blocked a lot of people. Unblock some first." : error.message);
  return data as BlockResult;
}

export async function unblockUser(userId: string): Promise<void> {
  await requireUser();
  const { error } = await (await createClient()).rpc("unblock_user", { p_user: userId });
  if (error) throw new Error(error.message);
}

/** The people you've blocked, for settings. Empty when signed out or in preview mode. */
export async function listMyBlocks(): Promise<BlockedPerson[]> {
  if (getDataMode() !== "live") return [];
  const { data, error } = await (await createClient()).rpc("my_blocks");
  if (error) return [];
  return (data ?? []) as BlockedPerson[];
}

/**
 * Ids of the students you've blocked, to leave out of lists (RLS shows only your own blocks).
 * Takes the caller's Supabase client so list queries reuse their session.
 */
export async function blockedIds(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  const { data, error } = await supabase.from("user_blocks").select("blocked_id").limit(500);
  if (error || !data) return []; // before migration 035, or signed out: nobody is hidden
  return data.map((row) => row.blocked_id as string);
}

/** A PostgREST filter value for `.not(column, "in", …)`. */
export const inList = (ids: string[]) => `(${ids.join(",")})`;
