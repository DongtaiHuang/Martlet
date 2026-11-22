import { z } from "zod";
import type { CreateTrendInput, TrendType } from "../types/trend";

// Dependency-free on purpose so node --test can import it directly, matching
// lib/poll-validation.ts. Approved location IDs arrive as an argument.

// Pure validation shared by the server (lib/trends.ts) and, optionally,
// client forms. The database re-enforces the same rules (see
// supabase/migrations), so client-side use is only for friendlier errors.

export const TREND_TYPES = [
  "coffee", "study", "recipe", "song",
] as const satisfies readonly TrendType[];

export const TREND_TITLE_MIN = 3;
export const TREND_TITLE_MAX = 120;
export const TREND_DETAIL_MAX = 280;
export const TREND_LINK_MAX = 300;

export const trendTypeSchema = z.enum(TREND_TYPES);

const createTrendSchema = z.object({
  title: z.string().trim()
    .min(TREND_TITLE_MIN, `Title must be at least ${TREND_TITLE_MIN} characters.`)
    .max(TREND_TITLE_MAX, `Title must be at most ${TREND_TITLE_MAX} characters.`),
  type: z.enum(TREND_TYPES, "Choose a valid trend type."),
  detail: z.string().trim()
    .max(TREND_DETAIL_MAX, `Detail must be at most ${TREND_DETAIL_MAX} characters.`)
    .default(""),
  link: z.string().trim()
    .max(TREND_LINK_MAX, `Links can contain at most ${TREND_LINK_MAX} characters.`)
    .refine((value) => value === "" || value.startsWith("https://"), "Links must start with https://")
    .default(""),
  campus_location_id: z.string("Choose an approved campus location.")
    .trim()
    .min(1, "Choose an approved campus location.")
    .nullable()
    .default(null),
});

export type TrendFieldErrors = Partial<Record<keyof CreateTrendInput | "form", string>>;

export type TrendValidationResult =
  | { ok: true; value: CreateTrendInput }
  | { ok: false; errors: TrendFieldErrors };

export function validateCreateTrendInput(input: unknown, approvedLocationIds: readonly string[]): TrendValidationResult {
  const parsed = createTrendSchema.safeParse(input);
  if (!parsed.success) {
    const errors: TrendFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = (issue.path[0] ?? "form") as keyof TrendFieldErrors;
      errors[field] ??= issue.message;
    }
    return { ok: false, errors };
  }

  const data = parsed.data;
  if (data.campus_location_id !== null && !approvedLocationIds.includes(data.campus_location_id)) {
    return { ok: false, errors: { campus_location_id: "Choose one of the approved campus locations, or leave the entry address-free." } };
  }

  return { ok: true, value: data };
}

export function isValidTrendType(value: unknown): value is TrendType {
  return trendTypeSchema.safeParse(value).success;
}
