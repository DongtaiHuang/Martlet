import { z } from "zod";
import { trendFailureCategory } from "@/lib/trend-diagnostics";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { mockTrendList } from "@/lib/mock-trends";
import { MockModeError } from "@/lib/meetups";
import { AuthRequiredError } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { fetchTrendImage } from "@/lib/trend-image-fetch";
import { TREND_TYPES, validateCreateTrendInput } from "@/lib/trend-validation";
import type { TrendEntry, TrendType } from "@/types/trend";

const idSchema = z.uuid();
const IMAGE_BUCKET = "trend-images";
const IMAGE_URL_SECONDS = 3600;

const campusLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const entrySchema = z.object({
  id: idSchema,
  title: z.string(),
  type: z.enum(TREND_TYPES),
  detail: z.string(),
  link: z.string(),
  campusLocation: campusLocationSchema.nullable(),
  likeCount: z.number().int().nonnegative(),
  likedByMe: z.boolean(),
  createdByMe: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  // Added by migration 030; absent on older databases.
  hasImage: z.boolean().default(false),
});

const listSchema = z.array(entrySchema).max(50);

export class TrendError extends Error {}

async function trendClient() {
  if (getDataMode() === "mock") throw new MockModeError("use trends");
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) {
    trendDiagnostic(error?.name === "AuthRetryableFetchError" ? "database-or-network-error" : "permission-denied-or-expired-session", "session");
    throw new AuthRequiredError("Sign in to use trends.");
  }
  return client;
}

function trendDiagnostic(category: string, operation: string, code?: string) {
  if (process.env.NODE_ENV === "development") {
    console.warn("[trends]", {
      category, operation, code,
      hint: category.startsWith("trend-") ? "Check migration 010, RPC grants, and PostgREST schema cache. See docs/SUPABASE_SETUP.md." : undefined,
    });
  }
}

function databaseError(error: { code: string }, operation: "read" | "create" | "like"): never {
  if (operation === "read" || ["42501", "PGRST202", "PGRST205", "42P01", "42883"].includes(error.code)) {
    trendDiagnostic(trendFailureCategory(error.code), operation, /^[A-Z0-9]{5,8}$/.test(error.code) ? error.code : undefined);
  }
  if (error.code === "42501") throw new TrendError("You don’t have permission to do that.");
  if (error.code === "P0002") throw new TrendError("This entry no longer exists.");
  if (error.code === "23505") throw new TrendError("This exact entry is already in the trends — like it instead of sharing it twice.");
  if (error.code === "22023") throw new TrendError("Check the title, type, detail and link.");
  if (operation !== "read" && trendFailureCategory(error.code) === "database-or-network-error") {
    trendDiagnostic("database-or-network-error", operation);
  }
  throw new TrendError("The trends service is unavailable. Try again later.");
}

export async function listTrends(type?: TrendType, limit = 20): Promise<TrendEntry[]> {
  if (getDataMode() === "mock") return mockTrendList(type).slice(0, limit);
  const client = await trendClient();
  const { data, error } = await client.rpc("get_trending_entries", { p_type: type ?? null, p_limit: limit });
  if (error) databaseError(error, "read");
  const parsed = listSchema.safeParse(data);
  if (!parsed.success) {
    trendDiagnostic("invalid-rpc-response", "read");
    throw new TrendError("The trends service is unavailable. Try again later.");
  }
  const withImages = parsed.data.filter((e) => e.hasImage);
  const signed = withImages.length
    ? (await client.storage.from(IMAGE_BUCKET).createSignedUrls(withImages.map((e) => `${e.id}.img`), IMAGE_URL_SECONDS)).data ?? []
    : [];
  const urls = new Map(signed.filter((u) => u.signedUrl && !u.error).map((u) => [u.path, u.signedUrl as string]));
  return parsed.data.map(({ hasImage, ...entry }) => ({ ...entry, imageUrl: hasImage ? urls.get(`${entry.id}.img`) ?? null : null }));
}

export async function createTrend(input: unknown) {
  const client = await trendClient();
  const parsed = validateCreateTrendInput(input, CAMPUS_LOCATIONS.map(({ id }) => id));
  if (!parsed.ok) throw new TrendError(Object.values(parsed.errors)[0] ?? "Check this entry.");
  const { title, type, detail, link, campus_location_id } = parsed.value;
  const { data: id, error } = await client.rpc("create_trend_entry", {
    p_title: title,
    p_type: type,
    p_detail: detail,
    p_link: link,
    p_campus_location_id: campus_location_id,
  });
  if (error) databaseError(error, "create");
  if (typeof id === "string") await attachImage(client, id, type, link);
}

/**
 * Album art or a recipe photo, fetched once by the server and copied into Martlet's storage
 * (ADR 0043). Optional: any failure leaves the entry without an image.
 */
async function attachImage(client: Awaited<ReturnType<typeof createClient>>, id: string, type: string, link: string) {
  const image = await fetchTrendImage(type, link);
  if (!image) return;
  const { error: uploadError } = await client.storage.from(IMAGE_BUCKET).upload(`${id}.img`, image.bytes, { contentType: image.mime });
  if (uploadError) {
    trendDiagnostic("image-upload-failed", "create");
    return;
  }
  const { error } = await client.rpc("attach_trend_image", { p_entry: id });
  if (error) trendDiagnostic("image-attach-failed", "create", error.code);
}

/** Deletes the signed-in student's files of removed trend images (ADR 0043). */
export async function purgeMyDeadTrendImages(): Promise<number> {
  if (getDataMode() !== "live") return 0;
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  if (!claims?.claims?.sub) return 0;
  const { data, error } = await client.rpc("my_trend_image_files_to_purge");
  if (error) throw new Error(error.message);
  const names = (data ?? []) as string[];
  if (names.length) {
    const removed = await client.storage.from(IMAGE_BUCKET).remove(names);
    if (removed.error) throw new Error(removed.error.message);
  }
  return names.length;
}

export async function setTrendLike(id: string, liked: boolean) {
  if (!idSchema.safeParse(id).success) throw new TrendError("This entry no longer exists.");
  const client = await trendClient();
  const { error } = await client.rpc("set_trend_like", { p_entry_id: id, p_liked: liked });
  if (error) databaseError(error, "like");
}
