# 0006. MapLibre with a configurable style

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The Explore page shows meetups on a campus map. Commercial map SDKs require API keys and billing, and tile usage terms differ between development and production.

## Decision

- Use MapLibre GL JS (open source) in `components/map/CampusMap.tsx`.
- The style URL comes from `NEXT_PUBLIC_MAP_STYLE_URL`. If unset, fall back to MapLibre's demo tiles, which are for development only.
- Popup content is built with DOM APIs and `textContent`, never by interpolating user-provided HTML.
- The map renders the same data as the feed (`listMeetups()`), not a separate source.

## Consequences

- No vendor lock-in or API key needed to develop locally.
- Before production, the team must pick a licensed style/tile provider that permits the deployed Vercel domain.
- The map is a client component and loads MapLibre's CSS and JS bundle on the Explore page.
