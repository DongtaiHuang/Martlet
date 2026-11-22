import { isAchievementId, type AchievementId, type EarnedMap } from "@/lib/achievement-catalog";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Server-only achievements service (ADR 0017). The user always comes from the Supabase
// session, never from the browser; RLS in supabase/migrations/010_achievements.sql is the
// real enforcement. Mock mode and signed-out users have no account to save to ("guest"),
// so the browser keeps their achievements locally.

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The achievements table doesn't exist yet (migration 008 hasn't been run). */
export class AchievementsNotSetUpError extends Error {
  constructor() {
    super("Achievements need supabase/migrations/010_achievements.sql to be run.");
    this.name = "AchievementsNotSetUpError";
  }
}

// PGRST205: PostgREST can't find the table; 42P01: Postgres "relation does not exist".
const isMissingTable = (error: { code?: string }) => error.code === "PGRST205" || error.code === "42P01";

async function sessionUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  return error || !data?.claims?.sub ? null : data.claims.sub;
}

/** The signed-in user's achievements, or null when there's no account (signed out or mock mode). */
export async function listMyAchievements(): Promise<EarnedMap | null> {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const userId = await sessionUserId(supabase);
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_id, earned_at")
    .eq("user_id", userId)
    .returns<{ achievement_id: string; earned_at: string }[]>();
  if (error) throw isMissingTable(error) ? new AchievementsNotSetUpError() : error;
  const earned: EarnedMap = {};
  // Ignore ids that were removed from the catalogue.
  for (const row of data ?? []) if (isAchievementId(row.achievement_id)) earned[row.achievement_id] = row.earned_at;
  return earned;
}

/**
 * Saves an achievement for the signed-in user. "already" if they had it; "guest" if there's
 * no account, or the table isn't set up yet (the browser keeps it instead).
 */
export async function recordAchievement(id: AchievementId): Promise<"new" | "already" | "guest"> {
  if (getDataMode() === "mock") return "guest";
  const supabase = await createClient();
  const userId = await sessionUserId(supabase);
  if (!userId) return "guest";
  const { error } = await supabase.from("user_achievements").insert({ user_id: userId, achievement_id: id });
  if (!error) return "new";
  if (error.code === "23505") return "already"; // primary key: earned before
  if (isMissingTable(error)) return "guest";
  throw error;
}
