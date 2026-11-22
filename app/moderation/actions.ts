"use server";

import { revalidatePath } from "next/cache";
import { isModerator } from "@/lib/board";
import { REPORT_REASONS } from "@/lib/board-catalog";
import { reportCommunityContent, reviewReportedContent, type CommunityType, type TargetType } from "@/lib/moderation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANDMARK = /^[a-z0-9-]{2,40}$/;
export type ReportState = { message: string; ok: boolean };
export async function reportCommunityAction(type: CommunityType, id: string, landmarkId: string, reason: string, note: string): Promise<ReportState> {
  if (!["meetup","landmark_photo"].includes(type) || !UUID.test(id) ||
      (type === "landmark_photo" ? !LANDMARK.test(landmarkId) : landmarkId !== "") ||
      !(reason in REPORT_REASONS) || note.length > 300) return { message: "Invalid report details.", ok: false };
  try {
    const outcome = await reportCommunityContent(type, id, landmarkId, reason as keyof typeof REPORT_REASONS, note);
    if (outcome === "unavailable") return { message: "This content is no longer available to report.", ok: false };
    if (outcome === "already") return { message: "You've already reported this. Thanks.", ok: true };
    revalidatePath("/moderation");
    revalidatePath(type === "meetup" ? `/meetups/${id}` : `/landmarks/${landmarkId}`);
    return { message: outcome === "hidden" ? "Thanks. This content is hidden pending moderator review." : "Thanks. A moderator will review your report.", ok: true };
  } catch (error) {
    console.error("Community report failed", error instanceof Error ? error.message : "unknown");
    return { message: "Couldn't submit your report. Please try again.", ok: false };
  }
}

export async function reviewAction(type: TargetType, id: string, landmarkId: string, decision: "remove" | "restore" | "dismiss", note = ""): Promise<{ error?: string }> {
  if (!UUID.test(id) || !["post","comment","meetup","landmark_photo"].includes(type) ||
      !["remove","restore","dismiss"].includes(decision) || note.length > 300 ||
      (type === "landmark_photo" ? !LANDMARK.test(landmarkId) : landmarkId !== "")) return { error: "Invalid moderation request." };
  if (!(await isModerator())) return { error: "Not authorized." };
  try {
    await reviewReportedContent(type, id, landmarkId, decision, note);
    revalidatePath("/moderation");
    revalidatePath("/board");
    revalidatePath("/meetups");
    revalidatePath("/explore");
    revalidatePath("/profile");
    revalidatePath("/landmarks");
    if (type === "meetup") revalidatePath(`/meetups/${id}`);
    if (type === "landmark_photo") {
      revalidatePath(`/landmarks/${landmarkId}`);
      revalidatePath("/progress");
    }
    return {};
  } catch (error) {
    console.error("Moderation decision failed", error instanceof Error ? error.message : "unknown");
    return { error: "Couldn't apply that decision. Check whether the report is still open." };
  }
}
