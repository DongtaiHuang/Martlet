"use server";

import { revalidatePath } from "next/cache";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { MockModeError } from "@/lib/meetups";
import { AuthRequiredError } from "@/lib/supabase/auth";
import { createTrend, purgeMyDeadTrendImages, setTrendLike, TrendError } from "@/lib/trends";
import { validateCreateTrendInput } from "@/lib/trend-validation";

export type TrendActionState = {
  errors?: Record<string, string | undefined>;
  message?: string;
};

function actionError(error: unknown): Record<string, string | undefined> {
  if (error instanceof MockModeError) {
    return { form: "Sharing trends needs Supabase. See docs/SUPABASE_SETUP.md." };
  }
  if (error instanceof TrendError || error instanceof AuthRequiredError) {
    return { form: error.message };
  }
  return { form: "Couldn’t share this entry. Refresh and try again." };
}

export async function submitTrendEntry(_state: TrendActionState, formData: FormData): Promise<TrendActionState> {
  const campusRaw = formData.get("campus_location_id");
  const input = {
    title: formData.get("title"),
    type: formData.get("type"),
    detail: formData.get("detail"),
    link: formData.get("link"),
    campus_location_id: typeof campusRaw === "string" && campusRaw !== "" ? campusRaw : null,
  };

  // Field-level errors for the form; the service revalidates on the server.
  const local = validateCreateTrendInput(input, CAMPUS_LOCATIONS.map(({ id }) => id));
  if (!local.ok) return { errors: local.errors };

  try {
    await createTrend(input);
  } catch (error) {
    return { errors: actionError(error) };
  }
  revalidatePath("/meetups");
  return { message: "Shared! It’s in the ranking — like it to push it up." };
}

/** Background clean-up of the student's own removed trend images (ADR 0043). */
export async function purgeTrendImagesAction(): Promise<void> {
  await purgeMyDeadTrendImages().catch((error) => console.error("Trend image purge failed", error));
}

export async function likeTrend(entryId: string): Promise<void> {
  await setTrendLike(entryId, true);
  revalidatePath("/meetups");
}

export async function unlikeTrend(entryId: string): Promise<void> {
  await setTrendLike(entryId, false);
  revalidatePath("/meetups");
}
