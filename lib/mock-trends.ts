import type { TrendEntry, TrendType } from "@/types/trend";

// Sample data for mock mode (no Supabase credentials). Mirrors lib/mock-meetups.ts.
// Ordered by like count so the trending ranking is visible in the preview.

const entries: TrendEntry[] = [
  {
    id: "d1c2b3a4-0001-4a5b-8c6d-300000000001",
    title: "Le James Café flat white",
    type: "coffee",
    detail: "Quiet corner tables in the morning and the best flat white on campus.",
    link: "",
    campusLocation: { id: "arts-building", name: "Arts Building", latitude: 45.505, longitude: -73.5775 },
    likeCount: 14,
    likedByMe: false,
    createdByMe: false,
    createdAt: "2026-11-19T14:00:00.000Z",
    imageUrl: null,
  },
  {
    id: "d1c2b3a4-0002-4a5b-8c6d-300000000002",
    title: "Redpath 6th floor carrels",
    type: "study",
    detail: "Silent study with a view over the lower campus. Arrive before 10am during finals.",
    link: "",
    campusLocation: { id: "redpath-library", name: "Redpath Library", latitude: 45.50383233, longitude: -73.57742633 },
    likeCount: 11,
    likedByMe: false,
    createdByMe: false,
    createdAt: "2026-11-18T09:30:00.000Z",
    imageUrl: null,
  },
  {
    id: "d1c2b3a4-0003-4a5b-8c6d-300000000003",
    title: "Overnight oats, rez edition",
    type: "recipe",
    detail: "Rolled oats, frozen berries and a spoon of peanut butter prepared the night before an 8:30.",
    link: "",
    campusLocation: null,
    likeCount: 9,
    likedByMe: false,
    createdByMe: false,
    createdAt: "2026-11-17T21:10:00.000Z",
    imageUrl: null,
  },
  {
    id: "d1c2b3a4-0004-4a5b-8c6d-300000000004",
    title: "Trottier study lounges",
    type: "study",
    detail: "Glass lounges with whiteboards. Mornings are reliably free.",
    link: "",
    campusLocation: { id: "trottier-building", name: "Trottier Building", latitude: 45.50738884, longitude: -73.57882603 },
    likeCount: 7,
    likedByMe: false,
    createdByMe: false,
    createdAt: "2026-11-16T12:00:00.000Z",
    imageUrl: null,
  },
  {
    id: "d1c2b3a4-0005-4a5b-8c6d-300000000005",
    title: "SSMU coffee counter drip",
    type: "coffee",
    detail: "Student-run, cheapest drip on campus, and the line moves fast between classes.",
    link: "",
    campusLocation: { id: "university-centre", name: "SSMU University Centre", latitude: 45.50355653, longitude: -73.57814397 },
    likeCount: 6,
    likedByMe: false,
    createdByMe: false,
    createdAt: "2026-11-15T10:20:00.000Z",
    imageUrl: null,
  },
  {
    id: "d1c2b3a4-0006-4a5b-8c6d-300000000006",
    title: "Espresso yourself — study playlist",
    type: "song",
    detail: "Lo-fi opener that turns into walking-pace piano. Perfect for a McLennan grind session.",
    link: "https://open.spotify.com/track/example-mock",
    campusLocation: null,
    likeCount: 5,
    likedByMe: false,
    createdByMe: false,
    createdAt: "2026-11-20T08:45:00.000Z",
    imageUrl: null,
  },
];

export const MOCK_TRENDS: readonly TrendEntry[] = entries;

export function mockTrendList(type?: TrendType): TrendEntry[] {
  return entries
    .filter((entry) => type === undefined || entry.type === type)
    .sort((a, b) => b.likeCount - a.likeCount || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
