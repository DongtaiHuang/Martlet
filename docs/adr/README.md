# Architecture Decision Records

Short records of the significant decisions behind Martlet. Each ADR captures the context, the decision, and its consequences so teammates can understand *why* the code looks the way it does.

| #    | Title | Status |
|------|-------|--------|
| 0001 | [Record architecture decisions](0001-record-architecture-decisions.md) | Accepted |
| 0002 | [Next.js + Supabase foundation](0002-nextjs-supabase-foundation.md) | Accepted |
| 0003 | [Row-level security as the authorization boundary](0003-rls-authorization-boundary.md) | Accepted |
| 0004 | [Approved campus locations only, no live geolocation](0004-approved-campus-locations.md) | Superseded for meetup locations by 0015 (geolocation amended by 0008) |
| 0005 | [Peck/Flap participation and reaction model](0005-peck-flap-model.md) | Accepted |
| 0006 | [MapLibre with a configurable style](0006-maplibre-configurable-style.md) | Accepted |
| 0007 | [Frozen MVP scope and mock-first service contracts](0007-frozen-mvp-and-service-contracts.md) | Accepted |
| 0008 | [Client-side "show my location" on the map](0008-client-side-locate-me.md) | Accepted |
| 0009 | [Landmark photo unlocks with visit check-ins](0009-landmark-photo-unlocks.md) | Accepted |
| 0010 | [Martlet avatar with in-browser expression tracking](0010-martlet-avatar-expression-tracking.md) | Accepted |
| 0011 | [Advisory meetup polls and single-choice voting](0011-meetup-polls.md) | Superseded by 0022 |
| 0012 | [Landmark progress shown as a growing pixel-art tree](0012-progress-growth-tree.md) | Accepted |
| 0013 | [Landmarks map, tower pins that grow, and popup birds](0013-landmark-map-tower-pins.md) | Accepted |
| 0014 | [Colour tokens, themes and dark mode](0014-theme-tokens-and-dark-mode.md) | Accepted |
| 0015 | [Approved public venues for off-campus meetups](0015-public-meetup-venues.md) | Accepted |
| 0016 | [Google Maps and place IDs](0016-google-maps-and-place-ids.md) | Accepted (publishing searched places pending) |
| 0017 | [Like-ranked trends side panel](0017-trends-side-panel.md) | Accepted |
| 0018 | [Open the Landmarks map with all pins in 3D](0018-landmarks-overview.md) | Accepted |
| 0019 | [Achievements for niche and hidden features](0019-achievements.md) | Accepted |
| 0020 | [Activity achievements computed on read](0020-activity-achievements.md) | Accepted |
| 0021 | [Persistent, color-coded notifications](0021-notifications.md) | Accepted |
| 0022 | [Custom meeting spots and polling retirement](0022-custom-meeting-spots.md) | Accepted |
| 0023 | [Hosts edit their meetups through a checked database function](0023-host-meetup-editing.md) | Accepted |
| 0024 | [Seasonal themes with decorative scenes](0024-seasonal-themes-and-scenes.md) | Accepted |
| 0025 | [Guest browsing](0025-guest-browsing.md) | Accepted |
| 0026 | [Martlet Flight leaderboard](0026-flight-leaderboard.md) | Accepted |
| 0027 | [Community board and moderation](0027-community-board-and-moderation.md) | Accepted |
| 0028 | [CI test gates for production](0028-ci-test-gates.md) | Accepted |
| 0029 | [Custom themes from three colours](0029-custom-colour-themes.md) | Accepted |
| 0030 | [Tree species and levels after full bloom](0030-tree-species-and-bloom-levels.md) | Accepted |
| 0031 | [Customisable feed dashboard](0031-customisable-feed-dashboard.md) | Accepted |
| 0032 | [Campus weather from Open-Meteo](0032-campus-weather.md) | Accepted |
| 0033 | [Play-money prediction market](0033-prediction-market.md) | Accepted |
| 0034 | [Blackjack with Martlet points](0034-blackjack.md) | Accepted |
| 0035 | [Multiplayer blackjack tables](0035-blackjack-tables.md) | Accepted |
| 0036 | [Martlet Coin trading sim](0036-martlet-coin.md) | Accepted |
| 0037 | [Martlet Drift](0037-martlet-drift.md) | Accepted |
| 0038 | [Auto-cleanup of ended meetups](0038-meetup-cleanup.md) | Accepted |

## Adding a new ADR

1. Copy [`template.md`](template.md) to `NNNN-short-title.md` using the next number.
2. Fill it in, set status to `Proposed`, and open a PR.
3. Once merged, set status to `Accepted` and add it to the table above.
4. Don't rewrite an accepted ADR's decision. Supersede it with a new ADR and mark the old one `Superseded by NNNN`.
