import type { LandmarkSummary } from "@/types/landmark";
import { EXPO_67_ID } from "@/lib/achievement-catalog";

// Mock-mode copy of the landmarks seeded in supabase/migrations/006_landmarks.sql.
// Keep the two in sync. In mock mode everything is locked and there are no photos.
export function getMockLandmarks(): LandmarkSummary[] {
  return [
    {
      id: "saint-joseph-oratory", name: "Saint Joseph's Oratory", latitude: 45.4922, longitude: -73.6175, radius_m: 250,
      challenge_prompt: "Take a photo at the top of the Oratory steps with the city behind you.",
      description: "Montreal's largest church, on the slope of Mount Royal.",
    },
    {
      id: "old-port", name: "Old Port", latitude: 45.5072, longitude: -73.5531, radius_m: 800,
      challenge_prompt: "Take a photo on the waterfront with the Clock Tower or the Ferris wheel behind you.",
      description: "The historic port along the St. Lawrence in Old Montreal.",
    },
    {
      id: "redpath-museum", name: "Redpath Museum", latitude: 45.50446675, longitude: -73.57738453, radius_m: 75,
      challenge_prompt: "Strike your best dinosaur pose in front of the Redpath Museum.",
      description: "McGill's natural history museum, one of the oldest museum buildings in Canada.",
    },
    {
      id: "leacock-building", name: "Leacock Building", latitude: 45.50432553, longitude: -73.57786051, radius_m: 75,
      challenge_prompt: "Take a group photo at the Leacock Building entrance with your study crew.",
      description: "Home of many Arts classes on lower campus.",
    },
    {
      id: "rutherford-observatory", name: "Rutherford Observatory", latitude: 45.50717766, longitude: -73.57834928, radius_m: 75,
      challenge_prompt: "Take a photo from the street pointing up at the observatory dome on the Rutherford Physics Building.",
      description: "The rooftop observatory dome on the Rutherford Physics Building.",
    },
    {
      id: "la-banquise", name: "La Banquise", latitude: 45.5254, longitude: -73.5749, radius_m: 75,
      challenge_prompt: "Take a photo outside La Banquise. No purchase needed (poutine optional).",
      description: "The 24-hour poutine institution on Rue Rachel in the Plateau.",
    },
    {
      id: EXPO_67_ID, name: "Expo 67 Biosphère", latitude: 45.514092, longitude: -73.531389, radius_m: 100,
      challenge_prompt: "Take a photo doing the 67 hand gesture with the Biosphère dome behind you.",
      description: "The geodesic dome at Parc Jean-Drapeau was the United States pavilion at Expo 67.",
    },
  ].map((landmark) => ({ ...landmark, unlock_count: 0, unlocked: false }));
}
