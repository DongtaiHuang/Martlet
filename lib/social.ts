"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Server actions: the user ID always comes from the Supabase session cookie,
// never from the browser. RLS (001_mvp.sql) is the real authorization:
// only open, future meetups accept pecks/flaps, hosts can't peck their own,
// and users can only delete their own rows.

type Table = "meetup_pecks" | "meetup_flaps";

const meetupIdSchema = z.uuid();
const UNIQUE_VIOLATION = "23505";

async function getSession(meetupId: string) {
  if (!getSupabaseConfig()) throw new Error("Reactions need Supabase. Demo meetups are read-only.");
  const parsed = meetupIdSchema.safeParse(meetupId);
  if (!parsed.success) throw new Error("Demo meetups can't be joined or liked.");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) throw new Error("Sign in to react to meetups.");
  return { supabase, userId, meetupId: parsed.data };
}

function refresh(meetupId: string) {
  revalidatePath("/meetups");
  revalidatePath("/explore");
  revalidatePath(`/meetups/${encodeURIComponent(meetupId)}`);
}

async function add(table: Table, id: string) {
  const { supabase, userId, meetupId } = await getSession(id);
  const { error } = await supabase.from(table).insert({ meetup_id: meetupId, user_id: userId });
  // Duplicate = already reacted; the composite primary key keeps counts correct.
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error(`${table} insert failed`, error);
    throw new Error("This meetup isn't accepting reactions.");
  }
  refresh(meetupId);
}

async function remove(table: Table, id: string) {
  const { supabase, userId, meetupId } = await getSession(id);
  const { error } = await supabase.from(table).delete().eq("meetup_id", meetupId).eq("user_id", userId);
  if (error) {
    console.error(`${table} delete failed`, error);
    throw new Error("Couldn't update your reaction.");
  }
  refresh(meetupId);
}

export async function peck(meetupId: string): Promise<void> { await add("meetup_pecks", meetupId); }
export async function unpeck(meetupId: string): Promise<void> { await remove("meetup_pecks", meetupId); }
export async function flap(meetupId: string): Promise<void> { await add("meetup_flaps", meetupId); }
export async function unflap(meetupId: string): Promise<void> { await remove("meetup_flaps", meetupId); }
