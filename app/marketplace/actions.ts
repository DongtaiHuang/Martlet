"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import {
  MarketplaceError, createListing, purgeMyDeadListingPhotos, removeListing, renewListing, sendListingMessage, setListingStatus,
} from "@/lib/marketplace";
import {
  CONDITIONS, LISTING_CATEGORIES, LISTING_KINDS, MAX_LISTING_PHOTOS, parsePrice,
  type ListingCategory, type ListingCondition, type ListingKind,
} from "@/lib/marketplace-catalog";
import { AuthRequiredError } from "@/lib/supabase/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE = 1_000_000; // each; four fit under the 4 MB action limit
export type FormState = { error?: string; fields?: Record<string, string> };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
function friendly(error: unknown): string {
  if (error instanceof MarketplaceError) return error.message;
  if (error instanceof AuthRequiredError) return "Sign in to do that.";
  console.error("Marketplace action failed", error);
  return "Something went wrong. Try again.";
}

export async function createListingAction(_: FormState, form: FormData): Promise<FormState> {
  const kind = str(form.get("kind")) as ListingKind;
  const category = str(form.get("category")) as ListingCategory;
  const title = str(form.get("title")).trim();
  const description = str(form.get("description")).trim();
  const price = str(form.get("price"));
  const condition = str(form.get("condition")) as ListingCondition | "";
  const courseCode = str(form.get("course")).trim().toUpperCase().replace(/^([A-Z]{4})\s*(\d)/, "$1 $2");
  const meetLocation = str(form.get("meet"));
  const fields = { kind, category, title, description, price, condition, course: courseCode, meet: meetLocation };

  if (!LISTING_KINDS.includes(kind)) return { error: "Choose what kind of listing this is.", fields };
  if (!LISTING_CATEGORIES.includes(category)) return { error: "Choose a category.", fields };
  if (title.length < 3 || title.length > 80) return { error: "The title needs 3 to 80 characters.", fields };
  if (description.length > 1000) return { error: "Keep the description under 1000 characters.", fields };
  if (condition && !CONDITIONS.includes(condition)) return { error: "Choose a condition.", fields };
  if (!CAMPUS_LOCATIONS.some((l) => l.id === meetLocation)) return { error: "Choose a campus spot to meet.", fields };
  if (courseCode && (category !== "textbooks" || !/^[A-Z]{4} \d{3}[A-Z0-9]{0,2}$/.test(courseCode))) {
    return { error: "Course codes look like COMP 202, and only go on textbooks.", fields };
  }
  if (form.get("rules") !== "on") return { error: "Confirm that your item is allowed.", fields };

  let priceCents: number | null = null;
  if (kind === "sell" || kind === "wanted") {
    priceCents = parsePrice(price);
    if (Number.isNaN(priceCents)) return { error: "Enter a price between $0 and $1,000, like 25 or 12.50.", fields };
    if (kind === "sell" && priceCents === null) return { error: "Set a price, or list it as free.", fields };
  }

  const photos: Uint8Array[] = [];
  for (const file of form.getAll("photos").slice(0, MAX_LISTING_PHOTOS)) {
    if (!(file instanceof Blob) || file.size === 0) continue;
    if (file.size > MAX_IMAGE) return { error: "A photo is too large.", fields };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return { error: "Photos must be JPEGs.", fields };
    photos.push(bytes);
  }

  let id: string;
  try {
    id = await createListing({ kind, category, title, description, priceCents, condition: condition || null, courseCode: courseCode || null, meetLocation, photos });
  } catch (error) {
    return { error: friendly(error), fields };
  }
  revalidatePath("/marketplace");
  redirect(`/marketplace/${id}`);
}

export async function listingStatusAction(id: string, status: "active" | "reserved" | "sold"): Promise<string | null> {
  if (!UUID.test(id)) return "That listing isn’t available.";
  try { await setListingStatus(id, status); } catch (error) { return friendly(error); }
  revalidatePath(`/marketplace/${id}`);
  revalidatePath("/marketplace");
  return null;
}

export async function renewListingAction(id: string): Promise<string | null> {
  if (!UUID.test(id)) return "That listing isn’t available.";
  try { await renewListing(id); } catch (error) { return friendly(error); }
  revalidatePath(`/marketplace/${id}`);
  return null;
}

export async function removeListingAction(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  await removeListing(id).catch((error) => console.error("Remove listing failed", error));
  revalidatePath("/marketplace");
  redirect("/marketplace?view=mine");
}

export async function messageAction(listingId: string, buyerId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const body = str(form.get("body")).trim();
  if (!UUID.test(listingId) || (buyerId !== null && !UUID.test(buyerId))) return { error: "That conversation isn’t available." };
  if (!body || body.length > 1000) return { error: "Write 1 to 1000 characters.", fields: { body } };
  try { await sendListingMessage(listingId, buyerId, body); } catch (error) { return { error: friendly(error), fields: { body } }; }
  revalidatePath(`/marketplace/${listingId}`);
  return {};
}

/** Background clean-up of the student's own removed listings' photo files (ADR 0040). */
export async function purgeListingPhotosAction(): Promise<void> {
  await purgeMyDeadListingPhotos().catch((error) => console.error("Listing photo purge failed", error));
}
