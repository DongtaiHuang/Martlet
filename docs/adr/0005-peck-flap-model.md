# 0005. Peck/Flap participation and reaction model

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Meetups need two kinds of user interaction: joining ("Peck") and liking ("Flap"). Counts must be accurate and resistant to duplicate clicks or race conditions.

## Decision

- Store each as a join table, `meetup_pecks` and `meetup_flaps`, with a composite primary key `(meetup_id, user_id)` so a user can peck/flap a meetup at most once.
- The host is an implicit participant with no `meetup_pecks` row: `attendee_count = 1 + count(pecks)`. Hosts cannot peck their own meetup.
- `has_pecked` / `has_flapped` reflect only the current user's rows.
- New pecks/flaps are allowed only on meetups that are `open` and in the future.
- Cancellation is a soft state change (`status = 'cancelled'`), not a delete: cancelled meetups are hidden from the upcoming feed but still render on their detail page.
- Times are stored as UTC `timestamptz` and displayed in the user's local timezone.

## Consequences

- The database guarantees idempotency, not application code.
- Counts are computed by aggregation; if this becomes slow, add counter columns or a view later.
- Unpeck/unflap are plain deletes of the user's own row.
