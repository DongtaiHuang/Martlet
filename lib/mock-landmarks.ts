import type { LandmarkSummary } from "@/types/landmark";
import { EXPO_67_ID } from "@/lib/achievement-catalog";

// Mock-mode copy of the landmarks seeded in supabase/migrations/006_landmarks.sql and
// 032_more_landmarks.sql (hidden ones left out).
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
    // 032_more_landmarks.sql
    {
      id: "roddick-gates", name: "Roddick Gates", latitude: 45.503889, longitude: -73.574885, radius_m: 60,
      challenge_prompt: "Take a photo walking through the Roddick Gates, campus behind you.",
      description: "McGill's main entrance on Sherbrooke Street, given in 1925 in memory of Sir Thomas Roddick.",
    },
    {
      id: "arts-building", name: "Arts Building", latitude: 45.505233, longitude: -73.577635, radius_m: 75,
      challenge_prompt: "Take a photo on the Arts Building steps with the cupola above you.",
      description: "McGill's oldest building, begun in 1839. James McGill's remains rest in front of it.",
    },
    {
      id: "three-bares", name: "The Three Bares", latitude: 45.504729, longitude: -73.577008, radius_m: 50,
      challenge_prompt: "Recreate the Three Bares pose by the fountain (fully clothed, please).",
      description: "Gertrude Vanderbilt Whitney's 1914 fountain on lower campus, officially \"The Friendly Gathering\".",
    },
    {
      id: "mclennan-library", name: "McLennan Library", latitude: 45.503288, longitude: -73.575968, radius_m: 75,
      challenge_prompt: "Take a photo outside McLennan with your exam-season study stack.",
      description: "The humanities and social sciences library, joined to Redpath Library: the study heart of campus.",
    },
    {
      id: "mount-royal-cross", name: "Mount Royal Cross", latitude: 45.508839, longitude: -73.587902, radius_m: 100,
      challenge_prompt: "Take a photo with the Mount Royal Cross behind you.",
      description: "The lit cross on the summit, put up in 1924 and visible from all over campus.",
    },
    {
      id: "beaver-lake", name: "Beaver Lake", latitude: 45.4987, longitude: -73.597424, radius_m: 150,
      challenge_prompt: "Take a photo by Beaver Lake: skates in winter, a picnic in summer.",
      description: "Lac aux Castors, the pond on Mount Royal built in 1938 where the city skates every winter.",
    },
    {
      id: "chinatown-gates", name: "Chinatown gates", latitude: 45.507525, longitude: -73.56046, radius_m: 250,
      challenge_prompt: "Take a photo under one of Chinatown's four paifang gates.",
      description: "Montréal's Chinatown, framed by four traditional gates around De la Gauchetière Street.",
    },
    {
      id: "habitat-67", name: "Habitat 67", latitude: 45.498957, longitude: -73.54352, radius_m: 200,
      challenge_prompt: "Take a photo with Habitat 67's stacked boxes behind you, from the public path.",
      description: "Moshe Safdie's housing complex, built for Expo 67 from his McGill architecture thesis.",
    },
    {
      id: "mile-end-bagels", name: "Mile End bagels", latitude: 45.5228, longitude: -73.5986, radius_m: 300,
      challenge_prompt: "Take a photo with a bag of fresh bagels outside St-Viateur or Fairmount. No purchase needed.",
      description: "The two wood-fired bagel shops that settled the Montréal bagel debate (or started it).",
    },
    {
      id: "place-des-arts", name: "Place des Arts", latitude: 45.508469, longitude: -73.566518, radius_m: 120,
      challenge_prompt: "Take a photo on the Place des Arts esplanade, festival or not.",
      description: "The performing arts centre at the heart of the Quartier des Spectacles: Jazz Fest, Francos and more.",
    },
    {
      id: "botanical-garden", name: "Botanical Garden", latitude: 45.555574, longitude: -73.554583, radius_m: 300,
      challenge_prompt: "Take a photo at the Botanical Garden gates or by the Chinese Garden.",
      description: "Jardin botanique de Montréal, one of the world's largest botanical gardens, next to Olympic Park.",
    },
    {
      id: "lachine-canal", name: "Lachine Canal", latitude: 45.4934, longitude: -73.553691, radius_m: 250,
      challenge_prompt: "Take a photo on the canal path by the Peel Basin, bike or no bike.",
      description: "The 1825 canal that built industrial Montréal, now a 14 km cycling and walking path.",
    },
  ].map((landmark) => ({ ...landmark, unlock_count: 0, unlocked: false }));
}
