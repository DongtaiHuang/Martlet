# 0037. Martlet Drift

- **Status:** Accepted
- **Date:** 2026-11-25
- **Issue:** #149

## Context

The team asked for a mini drifting game "with a BMW M4". BMW's name, badges and the M4's design are trademarks, and most free M4 3D models online aren't licensed for use in a public app.

## Decision

- **An unbranded sports coupe** built from simple shapes in Three.js: M4-like proportions (long hood, wide arches, dark roof, quad exhausts) with no maker's name, badge, kidney grille or signature lights. Paint colours have generic names.
- **React Three Fiber**, already a dependency for the avatar, loaded only on `/play/drift` (`next/dynamic`, no SSR).
- **Arcade physics** in `lib/drift.ts`, pure and unit-tested: velocity stays in the world frame while the body rotates, so turning faster than the tyres can follow makes the car slide. The handbrake drops rear grip, throttle in a slide keeps it low and turns some scrubbed sideways speed into drive (a power-slide holds its pace below top speed), and steering sets the angle. Fixed 120 Hz steps.
- **Scoring:** points while sliding 12°–100° above 8 m/s on the track, scaled by speed and angle; continuous drifting builds a ×2–×5 combo; points bank after a short pause, and leaving the track or spinning out loses the combo. A run is 90 seconds.
- **Leaderboard** (migration 022) works like Martlet Flight's (ADR 0026): the server times each run (at least 85 s, at most 15 minutes) and rejects scores above the physical maximum (2,300 points a second of driving, 207,000 a run). One best per student, display names only.
- **Controls:** keyboard, and on-screen buttons on touch screens. The game pauses when the tab loses focus. Reduced motion turns off tyre smoke.

## Consequences

- A determined player could still script inputs in the browser; the time and score caps only stop impossible scores, as with Flight.
- Swapping in a licensed car model later means replacing `Coupe.tsx`; the physics doesn't depend on it.
- New tracks are a list of control points (`CAMPUS_LOOP`).
