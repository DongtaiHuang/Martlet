import { z } from "zod";
import { MockModeError } from "@/lib/meetups";
import { AuthRequiredError } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/types/notification";

// Server-only notifications service (ADR 0021). Rows are created by
// security-definer RPCs in supabase/migrations/011_notifications.sql; clients
// read their own rows (RLS) and can only mark them read.

export class NotificationError extends Error {}

const idSchema = z.uuid();

const notificationSchema = z.object({
  id: idSchema,
  kind: z.enum(["meetup_new", "meetup_reminder", "trend_like", "meetup_updated"]),
  title: z.string(),
  body: z.string(),
  href: z.string(),
  meetupId: idSchema.nullable(),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

const listSchema = z.array(notificationSchema).max(100);

async function notificationClient() {
  if (getDataMode() === "mock") throw new MockModeError("use notifications");
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) {
    throw new AuthRequiredError("Sign in to use notifications.");
  }
  return client;
}

function diagnostic(category: string, operation: string, code?: string) {
  if (process.env.NODE_ENV === "development") {
    console.warn("[notifications]", { category, operation, code });
  }
}

function databaseError(error: { code: string }, operation: "read" | "write"): never {
  if (["42501", "PGRST202", "PGRST205", "42P01", "42883"].includes(error.code)) {
    diagnostic(error.code.startsWith("PGRST") || error.code === "42883" ? "notification-rpc-missing-or-stale-cache" : "permission-denied-or-expired-session", operation, error.code);
  }
  throw new NotificationError("The notification service is unavailable. Try again later.");
}

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  if (getDataMode() === "mock") return [];
  const client = await notificationClient();
  const { data, error } = await client.rpc("list_my_notifications", { p_limit: limit });
  if (error) databaseError(error, "read");
  const parsed = listSchema.safeParse(data);
  if (!parsed.success) {
    diagnostic("invalid-rpc-response", "read");
    throw new NotificationError("The notification service is unavailable. Try again later.");
  }
  return parsed.data;
}

/** Unread count for the bell; signed-out and preview mode count as zero. */
export async function countUnreadNotifications(): Promise<number> {
  if (getDataMode() === "mock") return 0;
  try {
    const client = await notificationClient();
    const { data, error } = await client.rpc("count_my_unread_notifications");
    if (error) databaseError(error, "read");
    return typeof data === "number" ? data : 0;
  } catch (error) {
    if (error instanceof AuthRequiredError) return 0;
    throw error;
  }
}

export async function markNotificationsRead(): Promise<number> {
  if (getDataMode() === "mock") return 0;
  const client = await notificationClient();
  const { data, error } = await client.rpc("mark_my_notifications_read");
  if (error) databaseError(error, "write");
  return typeof data === "number" ? data : 0;
}

/**
 * Fan-out for a freshly created meetup (course-matched for study meetups,
 * category-interest otherwise). Best-effort by contract: callers should treat
 * failures as non-fatal so notification problems never block creation.
 */
export async function notifyMeetupCreated(meetupId: string): Promise<void> {
  if (!idSchema.safeParse(meetupId).success) return;
  const client = await notificationClient();
  const { error } = await client.rpc("notify_meetup_created", { p_meetup_id: meetupId });
  if (error) databaseError(error, "write");
}

/**
 * Creates start-soon reminders for the signed-in student (idempotent). Called
 * on page load from the bell; failures are swallowed by the caller.
 */
export async function materializeReminders(): Promise<void> {
  if (getDataMode() === "mock") return;
  const client = await notificationClient();
  const { error } = await client.rpc("materialize_meetup_reminders");
  if (error) databaseError(error, "write");
}
