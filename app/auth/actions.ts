"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/supabase/redirect";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const MOCK_MODE_ERROR =
  "Sign-in is unavailable: Supabase is not configured, so Martlet is running in mock mode.";

const credentials = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72, "Password is too long."),
});

const signUpFields = credentials.extend({
  display_name: z.string().trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(30, "Display name must be at most 30 characters."),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!getSupabaseConfig()) return { error: MOCK_MODE_ERROR };

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: error.code === "email_not_confirmed"
        ? "Confirm your email first. Check your inbox for the link."
        : "Incorrect email or password.",
    };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!getSupabaseConfig()) return { error: MOCK_MODE_ERROR };

  const parsed = signUpFields.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const next = safeRedirectPath(formData.get("next"));
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ??
    `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      // Read by the handle_new_user trigger to fill profiles.display_name.
      data: { display_name: parsed.data.display_name },
    },
  });
  if (error) return { error: error.message };

  // With "Confirm email" disabled in Supabase, sign-up returns a session immediately.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  return { message: "Check your email for a confirmation link, then sign in." };
}

export async function signOut(): Promise<void> {
  if (getSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
