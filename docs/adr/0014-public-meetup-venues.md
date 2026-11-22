# 0014. Approved public venues for off-campus meetups

## Status

Proposed. Supersedes the campus-only meetup location rule in ADR 0004.

## Decision

Keep the campus catalog and add a small catalog of curated public Montréal venues. The creation form submits a catalog ID. The server supplies the corresponding name and coordinates and derives the host from the authenticated session. The selection preview reuses MapLibre and requests no device position.

A nullable `public_venue_id` distinguishes types. A null ID requires an approved campus tuple. A non-null ID requires an exact venue ID, name, and coordinate match. Two foreign keys enforce this for direct API writes and preserve existing campus rows. Authenticated clients can read the public venue catalog. Its rows are maintained by the team through migrations.

## Consequences

The existing feed, map, details, and profile history keep using the existing meetup location fields. Migration 008 is required to create off-campus meetups. A referenced campus or venue tuple stays fixed unless a later migration coordinates the change. People can still choose a specific meeting spot within a public venue in the meetup description.

OpenFreeMap serves map tiles. A broader place search needs a separately reviewed provider and server-side public-venue validation. Location polls still accept campus choices only and their results do not move a meetup.
