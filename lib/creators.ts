// Creator directory (ADR 0042). Components call these, not Supabase directly.
// Writes go through migration 029's RPCs, which take the user from the session and rate-limit.
import type { Discipline, RequestStatus } from "@/lib/creator-catalog";
import { getMockCreators } from "@/lib/mock-creators";
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "creator-works";
const URL_SECONDS = 3600;
const PAGE = 60;

export class CreatorError extends Error {}

export type CreatorWork = { id: string; title: string; caption: string; link: string | null; image_url: string | null };
export type Creator = {
  user_id: string; name: string; headline: string; bio: string; disciplines: Discipline[]; rates: string; links: string[];
  open_for_requests: boolean; status: "visible" | "hidden" | "removed"; updated_at: string;
  cover_url: string | null; works: CreatorWork[]; is_mine: boolean;
};
export type CreatorMessage = { id: string; body: string; mine: boolean; created_at: string; status: string };
export type CreatorRequest = {
  id: string; creator_id: string; creator_name: string; client_id: string; client_name: string; discipline: Discipline;
  budget_cents: number | null; needed_by: string | null; status: RequestStatus; created_at: string; updated_at: string;
  i_am_creator: boolean;
};

const PROFILE_SELECT = "user_id, headline, bio, disciplines, rates, links, open_for_requests, status, updated_at, owner:profiles!user_id(display_name)";
const WORK_SELECT = "id, creator_id, title, caption, link, has_image, created_at";
// creator_requests.creator_id points at creator_profiles, which a hidden profile would blank out,
// so creators' names come from a second profiles lookup.
const REQUEST_SELECT = "id, creator_id, client_id, discipline, budget_cents, needed_by, status, created_at, updated_at, client:profiles!client_id(display_name)";

type Named = { display_name: string } | { display_name: string }[] | null;
type ProfileRow = Omit<Creator, "name" | "cover_url" | "works" | "is_mine"> & { owner: Named };
type WorkRow = { id: string; creator_id: string; title: string; caption: string; link: string | null; has_image: boolean; created_at: string };
type RequestRow = Omit<CreatorRequest, "creator_name" | "client_name" | "i_am_creator"> & { client: Named };

const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const nameOf = (v: Named) => first(v)?.display_name ?? "A student";
const filePath = (w: { creator_id: string; id: string }) => `${w.creator_id}/${w.id}.jpg`;

export const isCreatorPreview = () => getDataMode() !== "live";

async function session() {
  if (getDataMode() !== "live") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return userId ? { supabase, userId } : null;
}
type Session = NonNullable<Awaited<ReturnType<typeof session>>>;

async function signed(s: Session, works: WorkRow[]): Promise<Map<string, string>> {
  const paths = works.filter((w) => w.has_image).map(filePath);
  if (!paths.length) return new Map();
  const { data } = await s.supabase.storage.from(BUCKET).createSignedUrls(paths, URL_SECONDS);
  return new Map((data ?? []).filter((u) => u.signedUrl && !u.error).map((u) => [u.path as string, u.signedUrl as string]));
}

function toCreator(s: Session, row: ProfileRow, works: WorkRow[], urls: Map<string, string>): Creator {
  const { owner, ...rest } = row;
  const mine = works.filter((w) => w.creator_id === row.user_id);
  const list = mine.map((w) => ({ id: w.id, title: w.title, caption: w.caption, link: w.link, image_url: w.has_image ? urls.get(filePath(w)) ?? null : null }));
  return { ...rest, name: nameOf(owner), works: list, cover_url: list.find((w) => w.image_url)?.image_url ?? null, is_mine: row.user_id === s.userId };
}

export type CreatorFilter = { discipline?: Discipline; q?: string; open?: boolean };

/** Visible creators, most recently updated first. Null when signed out. */
export async function listCreators(filter: CreatorFilter = {}): Promise<Creator[] | null> {
  if (getDataMode() === "mock") {
    return getMockCreators().filter((c) => (!filter.discipline || c.disciplines.includes(filter.discipline)) && (!filter.open || c.open_for_requests));
  }
  const s = await session();
  if (!s) return null;
  let query = s.supabase.from("creator_profiles").select(PROFILE_SELECT).eq("status", "visible").order("updated_at", { ascending: false }).limit(PAGE);
  if (filter.discipline) query = query.contains("disciplines", [filter.discipline]);
  if (filter.open) query = query.eq("open_for_requests", true);
  const q = filter.q?.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (q) query = query.or(`headline.ilike.%${q}%,bio.ilike.%${q}%,rates.ilike.%${q}%`);
  const { data, error } = await query.returns<ProfileRow[]>();
  if (error) throw new Error("Could not load creators", { cause: error });
  if (!data.length) return [];
  // One cover image per creator: the oldest work that has an image.
  const { data: works, error: workError } = await s.supabase.from("creator_works").select(WORK_SELECT)
    .in("creator_id", data.map((c) => c.user_id)).eq("has_image", true).order("created_at").returns<WorkRow[]>();
  if (workError) throw new Error("Could not load portfolios", { cause: workError });
  const covers = new Map<string, WorkRow>();
  for (const w of works) if (!covers.has(w.creator_id)) covers.set(w.creator_id, w);
  const urls = await signed(s, [...covers.values()]);
  return data.map((row) => toCreator(s, row, [...covers.values()], urls));
}

/** One creator with every work. Your own profile shows even while hidden. */
export async function getCreator(userId: string): Promise<Creator | null> {
  if (getDataMode() === "mock") return getMockCreators().find((c) => c.user_id === userId) ?? null;
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.supabase.from("creator_profiles").select(PROFILE_SELECT).eq("user_id", userId).returns<ProfileRow[]>().maybeSingle();
  if (error) throw new Error("Could not load the creator", { cause: error });
  if (!data) return null;
  const { data: works, error: workError } = await s.supabase.from("creator_works").select(WORK_SELECT).eq("creator_id", userId).order("created_at").returns<WorkRow[]>();
  if (workError) throw new Error("Could not load the portfolio", { cause: workError });
  return toCreator(s, data, works, await signed(s, works));
}

/** The signed-in student's own profile, or null if they haven't made one. */
export async function getMyCreator(): Promise<Creator | null> {
  const s = await session();
  return s ? getCreator(s.userId) : null;
}

async function toRequests(s: Session, rows: RequestRow[]): Promise<CreatorRequest[]> {
  const ids = [...new Set(rows.map((r) => r.creator_id))];
  const { data } = ids.length ? await s.supabase.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
  const names = new Map((data ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
  return rows.map(({ client, ...r }) => ({
    ...r, client_name: nameOf(client), creator_name: names.get(r.creator_id) ?? "A student", i_am_creator: r.creator_id === s.userId,
  }));
}

/** Requests you received as a creator and requests you sent, most recent activity first. */
export async function listMyRequests(): Promise<{ received: CreatorRequest[]; sent: CreatorRequest[] } | null> {
  const s = await session();
  if (!s) return null;
  // RLS returns only requests you're part of (moderators see all, so filter by side).
  const { data, error } = await s.supabase.from("creator_requests").select(REQUEST_SELECT)
    .or(`creator_id.eq.${s.userId},client_id.eq.${s.userId}`).order("updated_at", { ascending: false }).limit(200).returns<RequestRow[]>();
  if (error) throw new Error("Could not load requests", { cause: error });
  const all = await toRequests(s, data);
  return { received: all.filter((r) => r.i_am_creator), sent: all.filter((r) => !r.i_am_creator) };
}

/** One request and its thread. */
export async function getCreatorRequest(id: string): Promise<{ request: CreatorRequest; messages: CreatorMessage[] } | null> {
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.supabase.from("creator_requests").select(REQUEST_SELECT).eq("id", id).returns<RequestRow[]>().maybeSingle();
  if (error) throw new Error("Could not load the request", { cause: error });
  if (!data) return null;
  const { data: messages, error: messageError } = await s.supabase.from("creator_messages")
    .select("id, sender_id, body, status, created_at").eq("request_id", id).order("created_at").limit(500)
    .returns<{ id: string; sender_id: string; body: string; status: string; created_at: string }[]>();
  if (messageError) throw new Error("Could not load messages", { cause: messageError });
  return {
    request: (await toRequests(s, [data]))[0],
    messages: messages.map((m) => ({ id: m.id, body: m.body, status: m.status, created_at: m.created_at, mine: m.sender_id === s.userId })),
  };
}

function rpcError(error: { message: string; hint?: string; code?: string }): never {
  if (error.hint === "rate-limit") throw new CreatorError("You’re doing that a lot! Take a short break and try again later.");
  if (error.hint === "open-limit") throw new CreatorError("You already have two open requests with this creator. Wait for a reply or close one.");
  if (error.hint === "work-limit") throw new CreatorError("Your portfolio is full. Remove a work to add another.");
  if (error.hint === "past-date") throw new CreatorError("Pick a date from today on.");
  if (error.hint === "removed") throw new CreatorError("A moderator removed your creator profile, so it can’t be edited.");
  if (error.code === "23514" || error.code === "23503" || error.code === "22P02") throw new CreatorError("Check the form: something is missing or not allowed.");
  if (error.code === "P0002") throw new CreatorError("That creator or request isn’t available any more.");
  if (error.code === "42501") throw new CreatorError("You can’t do that.");
  throw new Error(error.message);
}

async function call<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc(fn, args);
  if (error) rpcError(error);
  return data as T;
}

export type CreatorProfileInput = { headline: string; bio: string; disciplines: Discipline[]; rates: string; links: string[]; open: boolean };

export const saveCreatorProfile = (p: CreatorProfileInput) =>
  call("save_creator_profile", { p_headline: p.headline, p_bio: p.bio, p_disciplines: p.disciplines, p_rates: p.rates, p_links: p.links, p_open: p.open }).then(() => undefined);
export const deleteMyCreatorProfile = () => call("delete_my_creator_profile", {}).then(() => undefined);

/** Adds a work; an image (a browser-resized JPEG) is uploaded right after, and the work is undone if that fails. */
export async function addCreatorWork(input: { title: string; caption: string; link: string | null; image: Uint8Array | null }): Promise<string> {
  const user = await requireUser();
  const id = await call<string>("add_creator_work", { p_title: input.title, p_caption: input.caption, p_link: input.link ?? "", p_has_image: input.image !== null });
  if (input.image) {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(`${user.id}/${id}.jpg`, input.image, { contentType: "image/jpeg" });
    if (error) {
      console.error("Creator work upload failed", error);
      await supabase.rpc("delete_creator_work", { p_work: id });
      throw new CreatorError("The image didn’t upload, so the work wasn’t added. Try again.");
    }
  }
  return id;
}
export const deleteCreatorWork = (id: string) => call("delete_creator_work", { p_work: id }).then(() => undefined);

export type NewCreatorRequest = { creatorId: string; discipline: Discipline; budgetCents: number | null; neededBy: string | null; body: string };
export const sendCreatorRequest = (r: NewCreatorRequest) =>
  call<string>("send_creator_request", { p_creator: r.creatorId, p_discipline: r.discipline, p_budget_cents: r.budgetCents, p_needed_by: r.neededBy, p_body: r.body });
export const sendCreatorMessage = (requestId: string, body: string) => call("send_creator_message", { p_request: requestId, p_body: body }).then(() => undefined);
export const setCreatorRequestStatus = (requestId: string, status: "accepted" | "declined" | "closed") =>
  call("set_creator_request_status", { p_request: requestId, p_status: status }).then(() => undefined);

/** Deletes the signed-in student's files of deleted works or removed profiles (ADR 0042). */
export async function purgeMyDeadCreatorWorkFiles(): Promise<number> {
  const s = await session();
  if (!s) return 0;
  const { data, error } = await s.supabase.rpc("my_creator_work_files_to_purge");
  if (error) throw new Error(error.message);
  const names = (data ?? []) as string[];
  if (names.length) {
    const removed = await s.supabase.storage.from(BUCKET).remove(names);
    if (removed.error) throw new Error(removed.error.message);
  }
  return names.length;
}
