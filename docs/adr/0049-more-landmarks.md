# 0049. More McGill and Montréal landmarks, and hiding landmarks

- **Status:** Accepted
- **Date:** 2026-11-26
- **Builds on:** [0009](0009-landmark-photo-unlocks.md) (landmark photo unlocks), [0013](0013-landmark-map-tower-pins.md) (tower pins)

## Context

Only three of fourteen landmarks were on campus, and two live landmarks ("Expo 67 Biosphère" and "Montréal Biosphère") were the same place. Unlocks are permanent (ADR 0009), so deleting a landmark would delete students' photos.

## Decision

- **Twelve new landmarks** with coordinates from OpenStreetMap:
  - **McGill:** Roddick Gates, Arts Building, The Three Bares and McLennan Library.
  - **Montréal:** Mount Royal Cross, Beaver Lake, the Chinatown gates (any of the four), Habitat 67, Mile End bagels (St-Viateur or Fairmount), Place des Arts, the Botanical Garden and the Lachine Canal at the Peel Basin.
  - Each has a public-space photo challenge that needs no purchase.
- **Hiding instead of deleting.** `landmarks.hidden` takes a landmark off maps and lists, and the unlock policy refuses new unlocks on it. Existing unlocks and their photos stay, and their owners can still edit them. "Montréal Biosphère" is hidden; "Expo 67 Biosphère" stays, because the "67" achievement depends on it.
- **Martlet Skies counts only landmarks inside its play area,** so "visit every landmark" can actually be done.

## Consequences

- Campus has seven landmarks, and the map spreads across more of the city.
- More landmarks raise the bar for "Full bloom" (unlock every landmark). That's intended.
- Several live landmarks (Atwater Market, Jean-Talon, Kondiaronk, the Museum of Fine Arts, Notre-Dame, the Olympic Stadium and Montréal Biosphère) were added in the dashboard, not in a migration, so a fresh database doesn't have them. Codifying them in a migration would be a follow-up.
