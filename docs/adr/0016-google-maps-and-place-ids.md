# 0016. Google Maps and place IDs

- **Status:** Accepted (Google map and search preview). Publishing searched places is still pending.
- **Date:** 2026-11-21

## Decision

Use the official Google Maps JavaScript loader on map and autocomplete routes. Use Advanced Markers and Places API (New)'s PlaceAutocompleteElement. Retain MapLibre as the fallback for independently sourced location coordinates when the browser key is absent. Google Places previews are shown exclusively on Google Maps.

Keep existing campus and curated venue writes until a verified place ID write path is available. A future migration should store a Place ID for this source and support location values resolved on read rather than indefinitely retaining names, addresses or coordinates from Google. A trusted server path must verify the session, validate the ID against Place Details (New), enforce geographic and public-place criteria, and prevent clients from fabricating either verified records or arbitrary coordinates. Feed, detail, Explore and profile reads must handle provider failure independently of meetup identity and social state.

## Consequences

Google Maps billing and key restrictions must be configured before testing the integration. Preview data is transient. The autocomplete preview does not change which venue gets published.
