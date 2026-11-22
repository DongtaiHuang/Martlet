export const CUSTOM_LOCATION_MIN = 3;
export const CUSTOM_LOCATION_MAX = 160;
export const CUSTOM_LOCATION_ERROR = "Enter a meeting spot between 3 and 160 characters.";
export const UNMAPPED_LOCATION_NOTE = "Exact map location unavailable. Refer to the meetup description for meeting instructions.";

export function isCustomLocationText(text: string): boolean {
  const length = Array.from(text.trim()).length;
  return length >= CUSTOM_LOCATION_MIN && length <= CUSTOM_LOCATION_MAX;
}

export function hasMeetupCoordinates<T extends { latitude: number | null; longitude: number | null }>(
  location: T,
): location is T & { latitude: number; longitude: number } {
  return location.latitude !== null && location.longitude !== null;
}
