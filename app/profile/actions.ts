"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type DisplayNameState = { message?: string; success?: boolean };

// Mirrors the profiles.display_name check constraint (2..30 characters).
const displayName = z.string().trim().min(2, "Use at least 2 characters.").max(30, "Use at most 30 characters.");

export async function updateDisplayName(_prev: DisplayNameState, formData: FormData): Promise<DisplayNameState> {
  const parsed = displayName.safeParse(formData.get("display_name"));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Invalid name." };

  try {
    // The user comes from the session; RLS + column grant only allow updating your own display_name.
    const user = await getCurrentUser();
    if (!user) return { message: "Sign in to change your name." };
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", user.id);
    if (error) throw error;
  } catch (error) {
    console.error("Display name update failed", error);
    return { message: "Couldn’t save your name. Try again." };
  }

  revalidatePath("/", "layout");
  return { success: true, message: "Name saved." };
}
