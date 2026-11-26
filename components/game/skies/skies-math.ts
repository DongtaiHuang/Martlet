// Flight maths for Martlet Skies (ADR 0046). Pure and dependency-free so node --test can import it.

export type Bird = { lng: number; lat: number; heading: number; altitude: number };

const M_PER_DEG_LAT = 111_320;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** The play area: downtown campus from Sherbrooke up to the foot of Mount Royal. */
export const BOUNDS = { west: -73.5905, east: -73.5640, south: 45.4985, north: 45.5115 } as const;
export const START: Bird = { lng: -73.5748, lat: 45.5021, heading: 330, altitude: 80 }; // over Sherbrooke St by the Roddick Gates, facing the mountain

export const ALTITUDE = { min: 35, max: 220 } as const;
export const SPEED = { cruise: 22, boost: 42 } as const; // m/s
export const TURN_RATE = 80; // degrees a second
export const CLIMB_RATE = 45; // metres a second

/** Distance in metres between two points (equirectangular: plenty for a campus). */
export function distanceM(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const x = toRad(bLng - aLng) * Math.cos(toRad((aLat + bLat) / 2));
  const y = toRad(bLat - aLat);
  return Math.hypot(x, y) * 6_371_000;
}

/** Compass bearing from a to b, 0 = north, clockwise, 0..360. */
export function bearingDeg(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const x = (bLng - aLng) * Math.cos(toRad((aLat + bLat) / 2));
  const y = bLat - aLat;
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/** Signed difference b - a in degrees, -180..180. */
export const angleDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;

export type Controls = { left: boolean; right: boolean; up: boolean; down: boolean; boost: boolean };

/**
 * One step of flight. Steering turns, up/down climbs and dives, boost speeds up. At the edge of
 * the play area the bird is held inside and gently turned back toward the centre.
 */
export function step(bird: Bird, c: Controls, dt: number): Bird & { atEdge: boolean } {
  let heading = bird.heading + ((c.right ? 1 : 0) - (c.left ? 1 : 0)) * TURN_RATE * dt;
  const altitude = Math.min(ALTITUDE.max, Math.max(ALTITUDE.min, bird.altitude + ((c.up ? 1 : 0) - (c.down ? 1 : 0)) * CLIMB_RATE * dt));
  const speed = c.boost ? SPEED.boost : SPEED.cruise;
  const metres = speed * dt;
  let lat = bird.lat + (metres * Math.cos(toRad(heading))) / M_PER_DEG_LAT;
  let lng = bird.lng + (metres * Math.sin(toRad(heading))) / (M_PER_DEG_LAT * Math.cos(toRad(bird.lat)));

  const atEdge = lng < BOUNDS.west || lng > BOUNDS.east || lat < BOUNDS.south || lat > BOUNDS.north;
  if (atEdge) {
    lng = Math.min(BOUNDS.east, Math.max(BOUNDS.west, lng));
    lat = Math.min(BOUNDS.north, Math.max(BOUNDS.south, lat));
    const home = bearingDeg(lng, lat, START.lng, START.lat);
    heading += Math.sign(angleDiff(heading, home)) * Math.min(Math.abs(angleDiff(heading, home)), TURN_RATE * 1.5 * dt);
  }
  return { lng, lat, heading: (heading + 360) % 360, altitude, atEdge };
}

/** Map zoom for an altitude: low and close near the rooftops, wider when high. */
export const zoomFor = (altitude: number) => 18.6 - Math.log2(altitude / ALTITUDE.min) * 0.9;

/** The nearest of `places` to the bird, with its distance and bearing. */
export function nearest<T extends { longitude: number; latitude: number }>(bird: Bird, places: readonly T[]) {
  let best: { place: T; distance: number; bearing: number } | null = null;
  for (const place of places) {
    const d = distanceM(bird.lng, bird.lat, place.longitude, place.latitude);
    if (!best || d < best.distance) best = { place, distance: d, bearing: bearingDeg(bird.lng, bird.lat, place.longitude, place.latitude) };
  }
  return best;
}
