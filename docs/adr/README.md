# Architecture Decision Records

Short records of the significant decisions behind Martlet. Each ADR captures the context, the decision, and its consequences so teammates can understand *why* the code looks the way it does.

| #    | Title | Status |
|------|-------|--------|
| 0001 | [Record architecture decisions](0001-record-architecture-decisions.md) | Accepted |
| 0002 | [Next.js + Supabase foundation](0002-nextjs-supabase-foundation.md) | Accepted |
| 0003 | [Row-level security as the authorization boundary](0003-rls-authorization-boundary.md) | Accepted |
| 0004 | [Approved campus locations only, no live geolocation](0004-approved-campus-locations.md) | Superseded for meetup locations by 0014 (geolocation amended by 0008) |
| 0005 | [Peck/Flap participation and reaction model](0005-peck-flap-model.md) | Accepted |
| 0006 | [MapLibre with a configurable style](0006-maplibre-configurable-style.md) | Accepted |
| 0007 | [Frozen MVP scope and mock-first service contracts](0007-frozen-mvp-and-service-contracts.md) | Accepted |
| 0008 | [Client-side "show my location" on the map](0008-client-side-locate-me.md) | Proposed |
| 0009 | [Landmark photo unlocks with visit check-ins](0009-landmark-photo-unlocks.md) | Proposed |
| 0010 | [Martlet avatar with in-browser expression tracking](0010-martlet-avatar-expression-tracking.md) | Proposed |
| 0011 | [Advisory meetup polls and single-choice voting](0011-meetup-polls.md) | Proposed |
| 0012 | [Landmark progress shown as a growing pixel-art tree](0012-progress-growth-tree.md) | Proposed |
| 0013 | [Landmarks map, tower pins that grow, and popup birds](0013-landmark-map-tower-pins.md) | Proposed |
| 0014 | [Approved public venues for off-campus meetups](0014-public-meetup-venues.md) | Proposed |

## Adding a new ADR

1. Copy [`template.md`](template.md) to `NNNN-short-title.md` using the next number.
2. Fill it in, set status to `Proposed`, and open a PR.
3. Once merged, set status to `Accepted` and add it to the table above.
4. Don't rewrite an accepted ADR's decision. Supersede it with a new ADR and mark the old one `Superseded by NNNN`.
