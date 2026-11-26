import type { Creator } from "@/lib/creators";

// Preview-mode sample creators (no Supabase). Read-only: profiles and requests need sign-in.
const base = Date.parse("2026-11-20T15:00:00Z");

const sample = (i: number, c: Partial<Creator> & Pick<Creator, "name" | "headline" | "disciplines">): Creator => ({
  user_id: `00000000-0000-4000-8000-0000000005${String(i).padStart(2, "0")}`,
  bio: "", rates: "", links: [], open_for_requests: true, status: "visible",
  updated_at: new Date(base - i * 3_600_000).toISOString(), cover_url: null, works: [], is_mine: false,
  ...c,
});

export function getMockCreators(): Creator[] {
  return [
    sample(1, {
      name: "Maya", headline: "Film and event photographer", disciplines: ["photography"], rates: "Portraits from $40, club events from $120",
      bio: "U3 Arts. I shoot on 35 mm film and digital: graduation portraits, club events and headshots around campus.",
      links: ["https://example.com/maya-photo"],
      works: [{ id: "w1", title: "Graduation portraits on lower field", caption: "Portra 400", link: null, image_url: null }],
    }),
    sample(2, {
      name: "Jonah", headline: "Beats, mixing and guitar lessons", disciplines: ["music", "tutoring"], rates: "Mixing $30 a track; lessons $20 an hour",
      bio: "Schulich student. I produce lo-fi and hip-hop beats and teach beginner guitar.",
      links: ["https://soundcloud.com/example"],
      works: [{ id: "w2", title: "Late night at Redpath (beat)", caption: "", link: "https://soundcloud.com/example/late-night", image_url: null }],
    }),
    sample(3, {
      name: "Priya", headline: "Websites for clubs and small projects", disciplines: ["coding", "design"], rates: "Free for student clubs",
      bio: "COMP major. Next.js and Tailwind sites, plus help debugging COMP 202 and 250 assignments (no doing them for you).",
      links: ["https://github.com/example"],
    }),
    sample(4, {
      name: "Luc", headline: "Character art and posters", disciplines: ["art", "design"], open_for_requests: false,
      bio: "Digital illustration and hand-drawn posters. Booked until exams are over.",
    }),
  ];
}
