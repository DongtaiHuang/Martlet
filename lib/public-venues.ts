import type { CampusLocation } from "@/lib/locations";

export const OTHER_LOCATION = "other";

export type PublicVenue = CampusLocation & { address: string };

// Keep these public meeting points in sync with the public_meetup_venues seed.
export const PUBLIC_VENUES: readonly PublicVenue[] = [
  { id: "atwater-market", name: "Atwater Market", address: "138 avenue Atwater, Montréal", latitude: 45.4789, longitude: -73.5767 },
  { id: "jean-talon-market", name: "Jean-Talon Market", address: "7070 avenue Henri-Julien, Montréal", latitude: 45.53597, longitude: -73.61522 },
  { id: "montreal-biosphere", name: "Montréal Biosphère", address: "160 chemin du Tour-de-l’Isle, Montréal", latitude: 45.514092, longitude: -73.531389 },
];

export function getPublicVenue(id: string): PublicVenue | undefined {
  return PUBLIC_VENUES.find((venue) => venue.id === id);
}
