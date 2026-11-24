# 0008. Client-side "show my location" on the map

- **Status:** Accepted
- **Date:** 2026-11-21
- **Amends:** [0004](0004-approved-campus-locations.md)

## Context

ADR 0004 bans browser geolocation to protect students' whereabouts. On the Explore map, though, students want to see where they are relative to meetups, especially if they're new to campus. The privacy risk in 0004 comes from **sharing or storing** a position, not from showing someone their own location on their own screen.

## Decision

- Add MapLibre's `GeolocateControl` (a "show my location" button) to `CampusMap`.
- **Opt-in only:** nothing is requested on page load. The browser permission prompt appears only after the user taps the button.
- **One-shot:** `trackUserLocation: false`, so there's no continuous tracking. Low accuracy (`enableHighAccuracy: false`) is enough to orient on campus.
- **Browser-only:** the position is used only by MapLibre to draw a dot and move the camera. It is never sent to our server or Supabase, logged, stored, put in URLs, or shown to other users.
- Everything else in 0004 still applies: meetup locations come only from `CAMPUS_LOCATIONS`, and there's no live location sharing or private addresses.

## Consequences

- Better orientation on the map with no new data collected and no schema or RLS changes.
- Needs a secure context (HTTPS or `localhost`). Vercel provides that.
- If the user denies permission, or the device has no location, the button just shows as disabled or errored. The rest of the map is unaffected.
- Any future feature that sends a user's position anywhere (e.g. "meetups near me" on the server, or sharing location with attendees) needs its own ADR.
