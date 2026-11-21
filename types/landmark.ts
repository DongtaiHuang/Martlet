// Landmark photo unlocks (ADR 0009).

export interface Landmark {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Check-in radius in metres (used by the phase-3 location check). */
  radius_m: number;
  challenge_prompt: string;
  description: string;
}

export interface LandmarkSummary extends Landmark {
  /** How many students have unlocked it (aggregate; visible even while locked). */
  unlock_count: number;
  /** Whether the current user has unlocked it. */
  unlocked: boolean;
}

export interface LandmarkPhoto {
  user_id: string;
  display_name: string;
  caption: string;
  /** Short-lived signed URL, or null if the photo is missing (e.g. upload failed). */
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
}

export interface LandmarkDetail extends LandmarkSummary {
  /** The current user's unlock, if any. */
  my_unlock: LandmarkPhoto | null;
}
