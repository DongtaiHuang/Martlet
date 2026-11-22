// Activity counts behind the martlet avatar (prototype). Server-only.
import type { Progress } from "@/components/avatar/items";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const PREVIEW_PROGRESS: Progress = { hosted: 4, joined: 12, landmarks: 5 };

export async function getAvatarProgress({ preview = false } = {}): Promise<{ name: string; progress: Progress; preview: boolean } | null> {
  if (preview || getDataMode() === "mock") return { name: "Preview student", progress: PREVIEW_PROGRESS, preview: true };

  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const [hosted, joined, landmarks] = await Promise.all([
    supabase.from("meetups").select("id").eq("host_id", user.id).neq("status", "cancelled"),
    supabase.from("meetup_pecks").select("meetup_id, meetup:meetups!inner(status)").eq("user_id", user.id).neq("meetup.status", "cancelled"),
    supabase.from("landmark_unlocks").select("landmark_id").eq("user_id", user.id),
  ]);
  if (hosted.error) throw new Error(`Failed to count hosted meetups: ${hosted.error.message}`);
  if (joined.error) throw new Error(`Failed to count joined meetups: ${joined.error.message}`);
  return {
    name: user.display_name,
    // Landmarks (migration 006) are optional.
    progress: { hosted: hosted.data.length, joined: joined.data.length, landmarks: landmarks.error ? 0 : landmarks.data.length },
    preview: false,
  };
}
