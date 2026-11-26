"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DISCIPLINES, MAX_DISCIPLINES, isCreatorLink, parseLinks, type Discipline } from "@/lib/creator-catalog";
import {
  CreatorError, addCreatorWork, deleteCreatorWork, deleteMyCreatorProfile, purgeMyDeadCreatorWorkFiles, saveCreatorProfile,
  sendCreatorMessage, sendCreatorRequest, setCreatorRequestStatus,
} from "@/lib/creators";
import { parsePrice } from "@/lib/marketplace-catalog";
import { AuthRequiredError } from "@/lib/supabase/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IMAGE = 1_000_000;
export type FormState = { error?: string; success?: string; fields?: Record<string, string> };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
function friendly(error: unknown): string {
  if (error instanceof CreatorError) return error.message;
  if (error instanceof AuthRequiredError) return "Sign in to do that.";
  console.error("Creator action failed", error);
  return "Something went wrong. Try again.";
}

export async function saveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const headline = str(form.get("headline")).trim();
  const bio = str(form.get("bio")).trim();
  const rates = str(form.get("rates")).trim();
  const linksText = str(form.get("links"));
  const disciplines = form.getAll("disciplines").map(str).filter((d): d is Discipline => DISCIPLINES.includes(d as Discipline));
  const open = form.get("open") === "on";
  const fields = { headline, bio, rates, links: linksText, disciplines: disciplines.join(","), open: open ? "on" : "" };

  if (headline.length < 3 || headline.length > 80) return { error: "The headline needs 3 to 80 characters.", fields };
  if (disciplines.length < 1 || disciplines.length > MAX_DISCIPLINES) return { error: `Pick 1 to ${MAX_DISCIPLINES} kinds of work.`, fields };
  if (bio.length > 1500) return { error: "Keep the about section under 1500 characters.", fields };
  if (rates.length > 200) return { error: "Keep rates under 200 characters.", fields };
  const links = parseLinks(linksText);
  if (!links) return { error: "Add up to 5 links, one per line, each starting with https://", fields };

  try {
    await saveCreatorProfile({ headline, bio, disciplines, rates, links, open });
  } catch (error) {
    return { error: friendly(error), fields };
  }
  revalidatePath("/creators", "layout");
  return { success: "Profile saved." };
}

export async function deleteProfileAction(): Promise<void> {
  await deleteMyCreatorProfile().catch((error) => console.error("Delete creator profile failed", error));
  revalidatePath("/creators", "layout");
  redirect("/creators");
}

export async function addWorkAction(_: FormState, form: FormData): Promise<FormState> {
  const title = str(form.get("title")).trim();
  const caption = str(form.get("caption")).trim();
  const link = str(form.get("link")).trim();
  const fields = { title, caption, link };
  if (title.length < 1 || title.length > 80) return { error: "Give the work a title (up to 80 characters).", fields };
  if (caption.length > 300) return { error: "Keep the caption under 300 characters.", fields };
  if (link && !isCreatorLink(link)) return { error: "Links must start with https://", fields };

  let image: Uint8Array | null = null;
  const file = form.get("image");
  if (file instanceof Blob && file.size > 0) {
    if (file.size > MAX_IMAGE) return { error: "That image is too large.", fields };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return { error: "Images must be JPEGs.", fields };
    image = bytes;
  }
  if (!image && !link) return { error: "Add an image, a link, or both.", fields };

  try {
    await addCreatorWork({ title, caption, link: link || null, image });
  } catch (error) {
    return { error: friendly(error), fields };
  }
  revalidatePath("/creators", "layout");
  return { success: "Added to your portfolio." };
}

export async function deleteWorkAction(id: string): Promise<string | null> {
  if (!UUID.test(id)) return "That work isn’t available.";
  try { await deleteCreatorWork(id); } catch (error) { return friendly(error); }
  revalidatePath("/creators", "layout");
  return null;
}

export async function requestAction(creatorId: string, _: FormState, form: FormData): Promise<FormState> {
  const discipline = str(form.get("discipline")) as Discipline;
  const budget = str(form.get("budget"));
  const neededBy = str(form.get("needed_by"));
  const body = str(form.get("body")).trim();
  const fields = { discipline, budget, needed_by: neededBy, body };
  if (!UUID.test(creatorId)) return { error: "That creator isn’t available.", fields };
  if (!DISCIPLINES.includes(discipline)) return { error: "Choose what kind of work this is.", fields };
  if (body.length < 10 || body.length > 1000) return { error: "Describe what you need in 10 to 1000 characters.", fields };
  if (neededBy && !DATE.test(neededBy)) return { error: "Pick a valid date.", fields };
  const budgetCents = parsePrice(budget);
  if (Number.isNaN(budgetCents)) return { error: "Enter a budget between $0 and $1,000, like 50 or 12.50, or leave it empty.", fields };

  let id: string;
  try {
    id = await sendCreatorRequest({ creatorId, discipline, budgetCents, neededBy: neededBy || null, body });
  } catch (error) {
    return { error: friendly(error), fields };
  }
  revalidatePath("/creators/requests");
  redirect(`/creators/requests/${id}`);
}

export async function requestMessageAction(requestId: string, _: FormState, form: FormData): Promise<FormState> {
  const body = str(form.get("body")).trim();
  if (!UUID.test(requestId)) return { error: "That request isn’t available." };
  if (!body || body.length > 1000) return { error: "Write 1 to 1000 characters.", fields: { body } };
  try { await sendCreatorMessage(requestId, body); } catch (error) { return { error: friendly(error), fields: { body } }; }
  revalidatePath(`/creators/requests/${requestId}`);
  return {};
}

export async function requestStatusAction(requestId: string, status: "accepted" | "declined" | "closed"): Promise<string | null> {
  if (!UUID.test(requestId)) return "That request isn’t available.";
  try { await setCreatorRequestStatus(requestId, status); } catch (error) { return friendly(error); }
  revalidatePath(`/creators/requests/${requestId}`);
  revalidatePath("/creators/requests");
  return null;
}

/** Background clean-up of the student's own dead portfolio files (ADR 0042). */
export async function purgeCreatorFilesAction(): Promise<void> {
  await purgeMyDeadCreatorWorkFiles().catch((error) => console.error("Creator file purge failed", error));
}
