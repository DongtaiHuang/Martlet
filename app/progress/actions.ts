"use server";

import { cookies } from "next/headers";
import { parseSpecies, SPECIES_COOKIE } from "@/lib/progress";

/** Saves the student's tree species (ADR 0030) in a cookie so /progress can draw it on the
 *  server. Cosmetic and device-only; unknown values fall back to the default species. */
export async function chooseSpecies(formData: FormData): Promise<void> {
  const species = parseSpecies(formData.get("species"));
  (await cookies()).set(SPECIES_COOKIE, species, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
