import type { MeetupSummary } from "@/types/meetup";
import { CAMPUS_LOCATIONS } from "@/lib/locations";

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function sample(
  id: string,
  title: string,
  category: MeetupSummary["category"],
  locationIndex: number,
  minuteOffset: number,
  host: string,
  attendeeCount: number,
  flapCount: number,
): MeetupSummary {
  const place = CAMPUS_LOCATIONS[locationIndex];
  return {
    id, title, category,
    host_id: "demo-host",
    host_display_name: host,
    description: "Open to anyone at McGill. Come say hi!",
    location_name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    starts_at: minutesFromNow(minuteOffset),
    created_at: new Date().toISOString(),
    status: "open",
    attendee_count: attendeeCount,
    flap_count: flapCount,
    has_pecked: false,
    has_flapped: false,
  };
}

// Mock-only data. Replace with Supabase service before final demo.
export function getMockMeetups(): MeetupSummary[] {
  return [
    sample("demo-coffee", "Coffee & a study break", "coffee", 1, 20, "Alex", 3, 8),
    { ...sample("demo-study", "COMP 302 group study", "study", 2, 65, "Jamie", 5, 12), course_code: "COMP 302" },
    sample("demo-sports", "Campus walk before dinner", "sports", 0, 120, "Sam", 2, 4),
    sample("demo-food", "Lunch after class?", "food", 3, 150, "Taylor", 4, 3),
    {
      ...sample("demo-custom", "Coffee in Mile End", "coffee", 0, 180, "Alex", 2, 0),
      description: "Meet outside the café entrance.",
      location_name: "Café Olimpico, Mile End",
      latitude: null,
      longitude: null,
    },
  ];
}
