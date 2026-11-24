# 0021. Persistent, color-coded notifications

- **Status:** Accepted
- **Date:** 2026-11-22
- **Builds on:** [0003](0003-rls-authorization-boundary.md) (RLS), [0007](0007-frozen-mvp-and-service-contracts.md) (RPC-only writes pattern)

## Context

Issues #25 and #30 ask for study-group notifications and meetup reminders, and the team also wants a notice when a meetup is created, visually separated by kind. Supabase Realtime push would need websockets and only reaches online users; reminders would additionally need a scheduler.

## Decision

Notifications are **rows in `notifications`**, written only by `security definer` RPCs (`supabase/migrations/011_notifications.sql`). Clients can read their own rows and mark them read (a column grant limits updates to `read_at`); there is deliberately no client insert or delete.

Three kinds, each with its own color in the UI (sky = new meetup, amber = reminder, violet = trend like):

- **`meetup_new`** — fanned out by `notify_meetup_created` right after the create action succeeds (best-effort: a failure never blocks creation). Recipients are course-matched students for study meetups with a course code, and students who previously pecked or flapped a meetup of the same category otherwise. The host never notifies themself.
- **`meetup_reminder`** — materialized by `materialize_meetup_reminders()` for meetups the student hosts or pecked that start within 2 hours. It runs on page load from the nav bell and is idempotent (a coalesce-based unique index dedupes per user/kind/subject), so **no cron is required**: the first visit after a meetup enters its window creates the reminder exactly once.
- **`trend_like`** — `set_trend_like` was extended (create-or-replace in 011) to notify the entry's owner on a *new* like only; self-likes and re-likes never notify.

The bell in the nav shows the unread count and links to `/notifications`, where rows are color-coded, unread-first, with a server-action "mark all read".

## Consequences

Notifications appear on the next render/navigation rather than live-pushed. The bell adds one read RPC (plus the idempotent reminder materialization) per page load in live mode. Reminders only fire for students who visit the app within the 2-hour window before a meetup starts — acceptable for the hackathon; a pg_cron or Realtime upgrade would be a new ADR.
