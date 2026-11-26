# 0038. Auto-cleanup of ended meetups

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

Meetups, with their Pecks, Flaps, polls and notifications, were kept forever. Feeds and the map already hide a meetup once it starts, so old rows only served the profile's "Meetup History". Quebec's Law 25 asks us to keep personal data (who met whom, where and when) only as long as it is useful. The upcoming meetup photo album (#117) also needs a timer that deletes things after an event.

Meetups have a start time but no end time.

## Decision

- `public.cleanup_ended_meetups()` deletes **open meetups 30 days after they start** and **cancelled meetups 7 days after their planned start**. Dependent rows go with them through the existing `on delete cascade` foreign keys.
- It runs **hourly with `pg_cron`** (job `cleanup-ended-meetups`). The migration enables `pg_cron` when it can; otherwise it warns, and the owner enables the extension and re-runs the file.
- The function is `security definer` and only the database owner may call it; students and guests can't.
- The periods are mirrored in `lib/meetup-retention.ts` so the profile can tell students how long their history is kept.
- Activity ladders and the tree's bloom level count only upcoming meetups (`loadActivityCounts`), and earned achievements are stored permanently, so cleanup doesn't take away progress.

## Consequences

- Profile history shows at most the last 30 days of meetups.
- The photo album (#117, ADR 0039) closes after 7 days through access rules rather than this job, because only the Storage API can delete files.
- Changing a period means a new migration that replaces the function, plus an update to `lib/meetup-retention.ts`.
- Projects without `pg_cron` keep every meetup until it's enabled; the function can also be run by hand in the SQL Editor.
