# 0023. Hosts edit their meetups through a checked database function

- **Status:** Accepted
- **Date:** 2026-11-22
- **Issue:** #73
- **Amends:** [0003](0003-rls-authorization-boundary.md) (hosts could previously only cancel), [0021](0021-notifications.md) (adds the `meetup_updated` notification)

## Context

Hosts need to fix a typo, move a meetup to a different time, or change where it happens. Since 002, the only column a host may update is `status`, and only to `cancelled`. Adding a second, broader UPDATE policy is unsafe. Postgres evaluates the old row against *any* policy's `USING` and the new row against *any* policy's `WITH CHECK`, so an edit policy next to the cancel policy would let a host re-open a cancelled meetup.

## Decision

- Editing goes through `public.update_my_meetup(p_meetup_id, p_meetup jsonb)` (migration 013), a `SECURITY DEFINER` function. Clients get no new column grants. The function checks:
  - the caller is the host
  - the meetup is `open` and hasn't started
  - the new start time is in the future
- The table's own constraints still apply to the update: title and description length, category, approved campus location or public venue foreign keys, custom-location shape, and the course existing (study meetups only).
- The app validates edits with exactly the same code as create (`lib/meetup-form.ts`, `validateCreateMeetupInput`). The edit page reuses `MeetupForm` in edit mode.
- If the **time or place** changes, everyone who pecked the meetup gets one `meetup_updated` notification. Older reminders for that meetup are cleared so they re-materialize at the new time (ADR 0021).
- Cancelled or started meetups can't be edited. The edit page explains why.

## Consequences

- Hosts can correct and reschedule meetups without cancelling and re-creating them, so attendee lists, pecks and flaps are kept.
- Status changes remain cancel-only. Re-opening stays impossible.
- Older public-venue meetups are edited as "Other" text, because the form only offers campus spots and custom text (ADR 0022).
- Migration 013 must be applied to the Supabase project before the edit form can save.
