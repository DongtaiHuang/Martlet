// Trends (issue #43): one ranked list of student-shared entries — favourite
// coffee spots, study spots, morning recipes and songs. Students like entries
// (one like each); the most liked rank first. Coffee/study entries may pin an
// approved campus location; recipes and songs are address-free.

export type TrendType = "coffee" | "study" | "recipe" | "song";

export interface TrendCampusLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface TrendEntry {
  id: string;
  title: string;
  type: TrendType;
  detail: string;
  /** "" or an https:// URL, e.g. a Spotify track for songs. */
  link: string;
  campusLocation: TrendCampusLocation | null;
  likeCount: number;
  likedByMe: boolean;
  createdByMe: boolean;
  createdAt: string;
}

export type CreateTrendInput = {
  title: string;
  type: TrendType;
  detail: string;
  link: string;
  campus_location_id: string | null;
};
