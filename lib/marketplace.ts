// Student marketplace (issue #48, ADR 0040). Components call these, not Supabase directly.
// Writes go through migration 026's RPCs, which take the user from the session and rate-limit.
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { getMockListings } from "@/lib/mock-listings";
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ListingCategory, ListingCondition, ListingKind, ListingStatus } from "@/lib/marketplace-catalog";

const BUCKET = "listing-photos";
const URL_SECONDS = 3600;
const PAGE = 60;

export class MarketplaceError extends Error {}

export type Listing = {
  id: string; seller_id: string; seller_name: string; kind: ListingKind; category: ListingCategory;
  title: string; description: string; price_cents: number | null; condition: ListingCondition | null;
  course_code: string | null; meet_location_id: string; meet_location_name: string; photo_count: number;
  status: ListingStatus; created_at: string; expires_at: string;
  photos: string[]; is_mine: boolean;
};

export type ThreadMessage = { id: string; body: string; mine: boolean; created_at: string; status: string };
export type Thread = { buyer_id: string; buyer_name: string; messages: ThreadMessage[] };

const SELECT = "id, seller_id, kind, category, title, description, price_cents, condition, course_code, meet_location_id, photo_count, status, created_at, expires_at, seller:profiles!seller_id(display_name)";
type Row = Omit<Listing, "seller_name" | "meet_location_name" | "photos" | "is_mine"> & {
  seller: { display_name: string } | { display_name: string }[] | null;
};

const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const locationName = (id: string) => CAMPUS_LOCATIONS.find((l) => l.id === id)?.name ?? "On campus";
const photoPaths = (row: { id: string; photo_count: number }, count = row.photo_count) =>
  Array.from({ length: Math.min(count, row.photo_count) }, (_, i) => `${row.id}/${i}.jpg`);

export const isMarketplacePreview = () => getDataMode() !== "live";

async function session() {
  if (getDataMode() !== "live") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return userId ? { supabase, userId } : null;
}
type Session = NonNullable<Awaited<ReturnType<typeof session>>>;

async function toListings(s: Session, rows: Row[], photosEach: number): Promise<Listing[]> {
  const paths = rows.flatMap((r) => photoPaths(r, photosEach));
  const signed = paths.length ? await s.supabase.storage.from(BUCKET).createSignedUrls(paths, URL_SECONDS) : { data: [] };
  const urls = new Map((signed.data ?? []).filter((u) => u.signedUrl && !u.error).map((u) => [u.path, u.signedUrl as string]));
  return rows.map(({ seller, ...r }) => ({
    ...r,
    seller_name: first(seller)?.display_name ?? "A student",
    meet_location_name: locationName(r.meet_location_id),
    photos: photoPaths(r, photosEach).map((p) => urls.get(p)).filter((u): u is string => Boolean(u)),
    is_mine: r.seller_id === s.userId,
  }));
}

export type ListingFilter = { category?: ListingCategory; kind?: ListingKind; q?: string; mine?: boolean };

/** Active and reserved listings, newest first (or all of the student's own). Null when signed out. */
export async function listListings(filter: ListingFilter = {}): Promise<Listing[] | null> {
  if (getDataMode() === "mock") return getMockListings().filter((l) => (!filter.category || l.category === filter.category) && (!filter.kind || l.kind === filter.kind));
  const s = await session();
  if (!s) return null;
  let query = s.supabase.from("listings").select(SELECT).order("created_at", { ascending: false }).limit(PAGE);
  if (filter.mine) query = query.eq("seller_id", s.userId).neq("status", "removed");
  else query = query.in("status", ["active", "reserved"]).gt("expires_at", new Date().toISOString());
  if (filter.category) query = query.eq("category", filter.category);
  if (filter.kind) query = query.eq("kind", filter.kind);
  const q = filter.q?.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,course_code.ilike.%${q}%`);
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error("Could not load listings", { cause: error });
  return toListings(s, data, 1);
}

/** One listing with all its photos and the conversations the viewer can see. */
export async function getListing(id: string): Promise<{ listing: Listing; threads: Thread[] } | null> {
  if (getDataMode() === "mock") {
    const listing = getMockListings().find((l) => l.id === id);
    return listing ? { listing, threads: [] } : null;
  }
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.supabase.from("listings").select(SELECT).eq("id", id).returns<Row[]>().maybeSingle();
  if (error) throw new Error("Could not load the listing", { cause: error });
  if (!data) return null;
  const [listing] = await toListings(s, [data], 4);

  // RLS returns only the viewer's own thread, or every thread for the seller.
  const { data: messages, error: messageError } = await s.supabase
    .from("listing_messages")
    .select("id, buyer_id, sender_id, body, status, created_at, buyer:profiles!buyer_id(display_name)")
    .eq("listing_id", id)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<{ id: string; buyer_id: string; sender_id: string; body: string; status: string; created_at: string; buyer: { display_name: string } | { display_name: string }[] | null }[]>();
  if (messageError) throw new Error("Could not load messages", { cause: messageError });
  const threads = new Map<string, Thread>();
  for (const m of messages) {
    const thread = threads.get(m.buyer_id) ?? { buyer_id: m.buyer_id, buyer_name: first(m.buyer)?.display_name ?? "A student", messages: [] };
    thread.messages.push({ id: m.id, body: m.body, mine: m.sender_id === s.userId, created_at: m.created_at, status: m.status });
    threads.set(m.buyer_id, thread);
  }
  // Most recent conversation first.
  const sorted = [...threads.values()].sort((a, b) => b.messages.at(-1)!.created_at.localeCompare(a.messages.at(-1)!.created_at));
  return { listing, threads: sorted };
}

function rpcError(error: { message: string; hint?: string; code?: string }): never {
  if (error.hint === "rate-limit") throw new MarketplaceError("You’re doing that a lot! Take a short break and try again later.");
  if (error.hint === "open-limit") throw new MarketplaceError("You have 20 open listings. Mark some as sold or remove them first.");
  if (error.code === "23514" || error.code === "23503") throw new MarketplaceError("Check the form: something is missing or not allowed.");
  if (error.code === "P0002") throw new MarketplaceError("That listing or conversation isn’t available any more.");
  if (error.code === "42501") throw new MarketplaceError("You can’t do that.");
  throw new Error(error.message);
}

export type NewListing = {
  kind: ListingKind; category: ListingCategory; title: string; description: string; priceCents: number | null;
  condition: ListingCondition | null; courseCode: string | null; meetLocation: string; photos: Uint8Array[];
};

export async function createListing(input: NewListing): Promise<string> {
  await requireUser();
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_listing", {
    p_kind: input.kind, p_category: input.category, p_title: input.title, p_description: input.description,
    p_price_cents: input.priceCents, p_condition: input.condition ?? "", p_course_code: input.courseCode ?? "",
    p_meet_location: input.meetLocation, p_photo_count: input.photos.length,
  });
  if (error) rpcError(error);
  const uploads = await Promise.all(input.photos.map((bytes, i) =>
    supabase.storage.from(BUCKET).upload(`${id}/${i}.jpg`, bytes, { contentType: "image/jpeg" })));
  if (uploads.some((u) => u.error)) {
    console.error("Listing photo upload failed", uploads.find((u) => u.error)?.error);
    await supabase.rpc("remove_my_listing", { p_listing: id });
    throw new MarketplaceError("The photos didn’t upload, so the listing wasn’t posted. Try again.");
  }
  return id as string;
}

async function call(fn: string, args: Record<string, unknown>) {
  await requireUser();
  const { error } = await (await createClient()).rpc(fn, args);
  if (error) rpcError(error);
}

export const setListingStatus = (id: string, status: "active" | "reserved" | "sold") => call("set_listing_status", { p_listing: id, p_status: status });
export const renewListing = (id: string) => call("renew_listing", { p_listing: id });
export const removeListing = (id: string) => call("remove_my_listing", { p_listing: id });
/** Buyers pass no buyerId; the seller replies into a buyer's thread. */
export const sendListingMessage = (id: string, buyerId: string | null, body: string) =>
  call("send_listing_message", { p_listing: id, p_buyer: buyerId, p_body: body });

/** Deletes the signed-in student's photo files of removed or deleted listings (ADR 0040). */
export async function purgeMyDeadListingPhotos(): Promise<number> {
  const s = await session();
  if (!s) return 0;
  const { data, error } = await s.supabase.rpc("my_listing_photo_files_to_purge");
  if (error) throw new Error(error.message);
  const names = (data ?? []) as string[];
  if (names.length) {
    const removed = await s.supabase.storage.from(BUCKET).remove(names);
    if (removed.error) throw new Error(removed.error.message);
  }
  return names.length;
}
