# 0004. Approved campus locations only, no live geolocation

- **Status:** Accepted, amended by [0008](0008-client-side-locate-me.md) (browser-only "show my location" on the map)
- **Date:** 2026-11-21

## Context

Meetups are visible to other students and plotted on a map. Allowing free-form coordinates or live device location risks exposing residences, private addresses, or a student's real-time whereabouts.

## Decision

- Meetup locations are chosen from a fixed list, `CAMPUS_LOCATIONS` in `lib/locations.ts`, of public McGill landmarks (building/entrance level, not indoor points).
- The frontend submits the name and coordinates of the selected entry; the server must revalidate against the approved list instead of trusting client coordinates.
- No browser geolocation, live location sharing, or private addresses.

## Consequences

- Strong privacy default and a simpler UI (a select instead of a map picker).
- Adding a location requires a code change to `lib/locations.ts`.
- ~~Follow-up: the database currently only range-checks latitude/longitude.~~ Resolved: `createMeetup()` revalidates against `CAMPUS_LOCATIONS` and stores canonical coordinates, and `002_security_hardening.sql` adds a `campus_locations` table with a composite foreign key so direct API writes are enforced too. The list now lives in two places (`lib/locations.ts` and the SQL seed) and must be kept in sync.
