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
  // Additional McGill downtown campus buildings; pins are approximate building-area locations.
  { id: "leacock-building", name: "Leacock Building", latitude: 45.50432553, longitude: -73.57786051 },
  { id: "burnside-hall", name: "Burnside Hall", latitude: 45.50463395, longitude: -73.57491447 },
  { id: "trottier-building", name: "Trottier Building", latitude: 45.50738884, longitude: -73.57882603 },
  { id: "rutherford-physics", name: "Rutherford Physics Building", latitude: 45.50717766, longitude: -73.57834928 },
  { id: "university-centre", name: "SSMU University Centre", latitude: 45.50355653, longitude: -73.57814397 },
  { id: "otto-maass", name: "Otto Maass Chemistry Building", latitude: 45.50476374, longitude: -73.57420108 },
  { id: "bronfman-building", name: "Bronfman Building", latitude: 45.50254452, longitude: -73.576608 },
  { id: "stewart-biology", name: "Stewart Biological Sciences Building", latitude: 45.50255891, longitude: -73.58087453 },
  { id: "mclennan-library", name: "McLennan Library", latitude: 45.50327, longitude: -73.57593 },
  { id: "mcconnell-engineering", name: "McConnell Engineering Building", latitude: 45.50598, longitude: -73.5761 },
];

export function getCampusLocation(id: string): CampusLocation | undefined {
  return CAMPUS_LOCATIONS.find((place) => place.id === id);
}

/**
 * The campus location a saved meetup was created at, if any. Meetups store the location's
 * name and coordinates (not its id), so all three must match; custom spots return undefined.
 */
export function findCampusLocationForMeetup(meetup: { location_name: string; latitude: number | null; longitude: number | null }): CampusLocation | undefined {
  return CAMPUS_LOCATIONS.find((l) => l.name === meetup.location_name && l.latitude === meetup.latitude && l.longitude === meetup.longitude);
}
