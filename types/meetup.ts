export type MeetupCategory =
  | "coffee"
  | "study"
  | "food"
  | "sports"
  | "gaming"
  | "other";

export type MeetupStatus = "open" | "cancelled";

export interface Meetup {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: MeetupCategory;
  location_name: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  status: MeetupStatus;
  created_at: string;
}

export type CreateMeetupInput = Pick<
  Meetup,
  "title" | "description" | "category" | "location_name" |
  "latitude" | "longitude" | "starts_at"
> & { public_venue_id?: string };

export interface MeetupSummary extends Meetup {
  host_display_name: string;
  attendee_count: number;
  flap_count: number;
  has_pecked: boolean;
  has_flapped: boolean;
}
