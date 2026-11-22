// Shared server-only moderation access. Database RPCs always authorize via auth.uid().
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isModerator, listOpenReports, type OpenReport } from "@/lib/board";
import { REPORT_REASONS, type ReportReason } from "@/lib/board-catalog";

export { REPORT_REASONS, type ReportReason };
export type CommunityType = "meetup" | "landmark_photo";
export type TargetType = "post" | "comment" | CommunityType;
export type CommunityReport = {
  target_type: CommunityType;
  target_id: string;
  landmark_id: string;
  count: number;
  reasons: string[];
  notes: string[];
  preview: string;
  photo_url: string | null;
  status: string;
  first_at: string;
};
export type ReviewItem = {
  type: TargetType;
  id: string;
  landmarkId: string;
  count: number;
  reasons: string[];
  notes: string[];
  preview: string;
  photoUrl: string | null;
  status: string;
  firstAt: string;
};

export type ReportOutcome = "reported" | "hidden" | "already" | "unavailable";

export async function reportCommunityContent(
  type: CommunityType, id: string, landmarkId: string, reason: ReportReason, note: string,
): Promise<ReportOutcome> {
  if (getDataMode() === "mock") throw new Error("Reporting needs a live account.");
  await requireUser();
  const { data, error } = await (await createClient()).rpc("report_community_content", {
    p_type: type, p_id: id, p_landmark_id: landmarkId, p_reason: reason, p_note: note,
  });
  if (error) throw error;
  return data as ReportOutcome;
}

export async function listCommunityReports(): Promise<CommunityReport[]> {
  if (!(await isModerator())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("community_reports")
    .select("target_type,target_id,landmark_id,reason,note,created_at")
    .is("resolved_at", null).order("created_at", { ascending: true });
  if (error) throw new Error("Unable to load community reports.");
  const map = new Map<string, CommunityReport>();
  for (const report of data ?? []) {
    const type = report.target_type as CommunityType;
    const key = [type, report.target_id, report.landmark_id].join(":");
    const item = map.get(key) ?? {
      target_type: type, target_id: report.target_id, landmark_id: report.landmark_id,
      count: 0, reasons: [], notes: [], preview: "", photo_url: null, status: "", first_at: report.created_at,
    };
    item.count += 1;
    if (!item.reasons.includes(report.reason)) item.reasons.push(report.reason);
    if (report.note) item.notes.push(report.note);
    map.set(key, item);
  }
  const groups = [...map.values()];
  const meetupIds = groups.filter((g) => g.target_type === "meetup").map((g) => g.target_id);
  const photoGroups = groups.filter((g) => g.target_type === "landmark_photo");
  const photoUserIds = [...new Set(photoGroups.map((g) => g.target_id))];
  const imagePaths = photoGroups.map((g) => `${g.target_id}/${g.landmark_id}.jpg`);
  const [meetups, photos, images] = await Promise.all([
    meetupIds.length ? supabase.from("meetups").select("id,title,description,moderation_status").in("id", meetupIds) : Promise.resolve({ data: [], error: null }),
    photoUserIds.length ? supabase.from("landmark_unlocks").select("user_id,landmark_id,caption,moderation_status").in("user_id", photoUserIds) : Promise.resolve({ data: [], error: null }),
    imagePaths.length ? supabase.storage.from("landmark-photos").createSignedUrls(imagePaths, 300) : Promise.resolve({ data: [], error: null }),
  ]);
  if (meetups.error || photos.error) throw new Error("Unable to load reported content.");
  const previewPhotos = new Map((images.data ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
  const previews = new Map<string, { preview: string; status: string; photo_url?: string | null }>();
  for (const m of meetups.data ?? []) {
    previews.set(`meetup:${m.id}:`, { preview: `${m.title} — ${m.description}`.slice(0, 240), status: m.moderation_status });
  }
  for (const p of photos.data ?? []) {
    previews.set(`landmark_photo:${p.user_id}:${p.landmark_id}`, {
      preview: `Photo at ${p.landmark_id} — ${p.caption || "(no caption)"}`.slice(0, 240),
      status: p.moderation_status,
      photo_url: previewPhotos.get(`${p.user_id}/${p.landmark_id}.jpg`) ?? null,
    });
  }
  return groups.map((g) => ({ ...g, ...(previews.get([g.target_type,g.target_id,g.landmark_id].join(":")) ?? { preview: "(unavailable)", status: "removed" }) }))
    .sort((a,b) => b.count - a.count || a.first_at.localeCompare(b.first_at));
}

export async function listReviewQueue(): Promise<ReviewItem[]> {
  if (!(await isModerator())) return [];
  const [board, community] = await Promise.all([listOpenReports(), listCommunityReports()]);
  const items: ReviewItem[] = [
    ...board.map((r: OpenReport) => ({
      type: r.target_type, id: r.target_id, landmarkId: "", count: r.count,
      reasons: r.reasons, notes: r.notes, preview: r.preview, photoUrl: null, status: r.status, firstAt: r.first_at,
    })),
    ...community.map((r) => ({
      type: r.target_type, id: r.target_id, landmarkId: r.landmark_id, count: r.count,
      reasons: r.reasons, notes: r.notes, preview: r.preview, photoUrl: r.photo_url, status: r.status, firstAt: r.first_at,
    })),
  ];
  return items.sort((a,b) => b.count - a.count || a.firstAt.localeCompare(b.firstAt));
}

export async function reviewReportedContent(
  type: TargetType, id: string, landmarkId: string, action: "restore" | "remove" | "dismiss", note = "",
): Promise<void> {
  if (!(await isModerator())) throw new Error("Not authorized to moderate.");
  const { error } = await (await createClient()).rpc("moderate_community_content", {
    p_type: type, p_id: id, p_landmark_id: landmarkId, p_action: action, p_note: note,
  });
  if (error) throw error;
}
