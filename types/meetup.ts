import type { MeetupCategory } from "@/lib/meetup-categories";
export type { MeetupCategory } from "@/lib/meetup-categories";

export type MeetupStatus = "open" | "cancelled";

export interface Meetup {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: MeetupCategory;
  categories: MeetupCategory[];
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  status: MeetupStatus;
  created_at: string;
  /** McGill course for study meetups, e.g. "COMP 202" (issue #25). Null or absent otherwise. */
  course_code?: string | null;
}

export type CreateMeetupInput = Pick<
  Meetup,
  "title" | "description" | "categories" | "location_name" |
  "latitude" | "longitude" | "starts_at" | "course_code"
> & { public_venue_id?: string; location_type?: "catalog" | "custom" };

export interface MeetupSummary extends Meetup {
  host_display_name: string;
  attendee_count: number;
  flap_count: number;
  has_pecked: boolean;
  has_flapped: boolean;
}
