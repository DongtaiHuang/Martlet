import { getVersion, setWorkerUrl } from "maplibre-gl";
import type { MeetupCategory } from "@/types/meetup";

// Shared by CampusMap (Explore) and MeetupLocationMap (meetup detail).

// Served from public/ by scripts/copy-maplibre-worker.mjs; the default relative URL 404s under Next.js.
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

export const MARKER_COLORS: Record<MeetupCategory, string> = {
  coffee: "#b45309", study: "#4338ca", food: "#c2410c",
  sports: "#047857", gaming: "#6d28d9", other: "#57534e",
};

export const CAMPUS_CENTER: [number, number] = [-73.577, 45.5045];
