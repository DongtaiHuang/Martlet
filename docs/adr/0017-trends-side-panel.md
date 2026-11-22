# 0017. Like-ranked trends side panel

- **Status:** Proposed

## Context

Students want to see what is popular on campus — favourite coffee and study spots, morning recipes, and songs — without leaving the feed. Issue #49 deferred McGill Spotify trends because the Spotify API needs OAuth approval and listening history is personal data under Law 25. Issue #43 originally proposed rating-based spot reviews, which would also need moderation (#45) before user-written reviews ship.

## Decision

A single `trend_entries` table holds student-shared entries of four types: coffee, study, recipe and song. Ranking is by like count only (`trend_likes`, one like per student per entry, idempotent toggle). There are no numeric ratings or free-text reviews yet, which keeps moderation (#45) a follow-up rather than a blocker. The panel renders as an aside on the meetup feed: most liked first, newest breaks ties.

Coffee and study entries may pin an approved campus location from `CAMPUS_LOCATIONS` (ADR 0004); recipes and songs are address-free. Songs are user-pasted `https://` links (e.g. a Spotify track URL). Martlet never calls the Spotify API and never touches listening history, so #49's deferral reasons do not apply to this feature.

The cookie-bound Supabase client calls narrowly scoped `security definer` RPCs; identity comes from `auth.uid()`. Public table writes and like reads are revoked, with RLS enabled as a second boundary. Duplicate titles per type are rejected by a unique index on `(type, lower(title))`.

## Consequences

Trends are advisory and social only: no editing or deleting entries, no time-windowed decay (rank is total likes), and no posting rate limits yet (#45 follow-up). Mock mode renders sample entries read-only with the sharing form hidden.
