# 0004. Approved campus locations only, no live geolocation

- **Status:** Accepted
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
- Follow-up: the database currently only range-checks latitude/longitude. Server-side revalidation must be implemented in `createMeetup()` (or moved into the database, e.g. a `campus_locations` table with a foreign key) to fully enforce this decision.
