export interface CampusLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Grounded in McGill Libraries' campus-building map coordinates.
// The markers identify buildings/entrances, not precise indoor meeting points.
export const CAMPUS_LOCATIONS: CampusLocation[] = [
  { id: "roddick-gates", name: "Roddick Gates", latitude: 45.50392014, longitude: -73.57495366 },
  { id: "redpath-library", name: "Redpath Library", latitude: 45.50383233, longitude: -73.57742633 },
  { id: "redpath-museum", name: "Redpath Museum", latitude: 45.50446675, longitude: -73.57738453 },
  { id: "arts-building", name: "Arts Building", latitude: 45.505, longitude: -73.5775 },
];

export function getCampusLocation(id: string): CampusLocation | undefined {
  return CAMPUS_LOCATIONS.find((place) => place.id === id);
}
