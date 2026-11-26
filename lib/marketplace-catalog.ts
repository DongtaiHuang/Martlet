// Marketplace catalog shared by server and browser (issue #48, ADR 0040).
// Mirrors the checks in supabase/migrations/026_marketplace.sql: keep them in sync.

export const LISTING_KINDS = ["sell", "free", "swap", "wanted"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export const KIND_INFO: Record<ListingKind, { label: string; verb: string; hint: string }> = {
  sell: { label: "For sale", verb: "Sell", hint: "Set a price. Buyers pay you in person: Martlet never handles money." },
  free: { label: "Free", verb: "Give away", hint: "Free to a good home." },
  swap: { label: "Swap", verb: "Swap", hint: "Say what you’d like in exchange." },
  wanted: { label: "Wanted", verb: "Ask for", hint: "Looking for something? Add a budget if you have one." },
};

export const LISTING_CATEGORIES = ["textbooks", "electronics", "furniture", "clothing", "kitchen", "sports", "other"] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const CATEGORY_INFO: Record<ListingCategory, { label: string; emoji: string }> = {
  textbooks: { label: "Textbooks", emoji: "📚" },
  electronics: { label: "Electronics", emoji: "💻" },
  furniture: { label: "Furniture", emoji: "🪑" },
  clothing: { label: "Clothing", emoji: "🧥" },
  kitchen: { label: "Kitchen", emoji: "🍳" },
  sports: { label: "Sports & outdoors", emoji: "⛸️" },
  other: { label: "Other", emoji: "📦" },
};

export const CONDITIONS = ["new", "like-new", "good", "fair"] as const;
export type ListingCondition = (typeof CONDITIONS)[number];
export const CONDITION_LABELS: Record<ListingCondition, string> = { new: "New", "like-new": "Like new", good: "Good", fair: "Fair" };

export const LISTING_STATUSES = ["active", "reserved", "sold", "hidden", "removed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_DAYS = 30;
export const MAX_LISTING_PHOTOS = 4;
export const MAX_PRICE_CENTS = 100_000;

/** Never allowed, whatever the price. Shown on the form; reports use "Prohibited item". */
export const PROHIBITED_ITEMS = [
  "Alcohol, cannabis, tobacco or vapes",
  "Medication, drugs or drug paraphernalia",
  "Weapons, including replicas and pepper spray",
  "Completed assignments, exams, essays or answer keys (academic integrity)",
  "Event or exam tickets resold above face value",
  "Counterfeit or stolen goods, accounts or IDs",
  "Animals",
  "Anything illegal in Quebec",
];

export function formatPrice(cents: number | null, kind: ListingKind): string {
  if (kind === "free") return "Free";
  if (kind === "swap") return "Swap";
  if (cents === null) return kind === "wanted" ? "Any budget" : "";
  if (cents === 0) return kind === "wanted" ? "Free" : "$0";
  const dollars = cents / 100;
  return dollars.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: cents % 100 ? 2 : 0 });
}

/** Parses "12", "12.5" or "$12.50" into cents; null if empty, NaN if invalid. */
export function parsePrice(input: string): number | null {
  const text = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!text) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) return Number.NaN;
  const cents = Math.round(Number(text) * 100);
  return cents > MAX_PRICE_CENTS ? Number.NaN : cents;
}
