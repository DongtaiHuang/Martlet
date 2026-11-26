import type { Listing } from "@/lib/marketplace";

// Preview-mode sample listings (no Supabase). Read-only: posting and messaging need sign-in.
const day = 86_400_000;
const base = Date.parse("2026-11-20T15:00:00Z");

const sample = (i: number, l: Partial<Listing> & Pick<Listing, "kind" | "category" | "title">): Listing => ({
  id: `00000000-0000-4000-8000-0000000004${String(i).padStart(2, "0")}`,
  seller_id: "preview", seller_name: ["Maya", "Jonah", "Priya", "Luc"][i % 4], description: "", price_cents: null, condition: null,
  course_code: null, meet_location_id: "redpath-library", meet_location_name: "Redpath Library", photo_count: 0, status: "active",
  created_at: new Date(base - i * day).toISOString(), expires_at: new Date(base + 30 * day).toISOString(), photos: [], is_mine: false,
  ...l,
});

export function getMockListings(): Listing[] {
  return [
    sample(1, { kind: "sell", category: "textbooks", title: "COMP 250 textbook (Java)", price_cents: 3500, condition: "good", course_code: "COMP 250", description: "Some highlighting in the first chapters." }),
    sample(2, { kind: "free", category: "furniture", title: "IKEA desk lamp", condition: "good", meet_location_id: "leacock-building", meet_location_name: "Leacock Building", description: "Moving out, pick it up this week." }),
    sample(3, { kind: "swap", category: "clothing", title: "Winter boots, size 9 for size 8", condition: "like-new", description: "Warm, waterproof, worn twice." }),
    sample(4, { kind: "wanted", category: "electronics", title: "Graphing calculator for MATH 133", price_cents: 4000 }),
    sample(5, { kind: "sell", category: "sports", title: "Ice skates, size 10", price_cents: 2500, condition: "fair", meet_location_id: "burnside-hall", meet_location_name: "Burnside Hall" }),
  ];
}
