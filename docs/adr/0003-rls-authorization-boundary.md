# 0003. Row-level security as the authorization boundary

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Supabase exposes the database directly to the browser through its API using a publishable key. Any check done only in the UI can be bypassed by calling the API directly. Acceptance tests require that user B cannot cancel user A's meetup "via UI **or direct database API**".

## Decision

- Enforce authorization in Postgres with row-level security (RLS) policies, defined in `supabase/migrations/001_mvp.sql`. RLS is enabled on every public table.
- Policies key off `auth.uid()`: users may insert only rows they own (`host_id`/`user_id = auth.uid()`), and only hosts may update their meetups.
- Service functions (`lib/meetups.ts`, `lib/social.ts`) derive the user from the authenticated Supabase session and **never accept a `userId` argument** from the client.
- The service-role key is never put in a `NEXT_PUBLIC_` variable or shipped to the browser.
- A `security definer` trigger on `auth.users` creates each user's profile row automatically.

## Consequences

- Impersonation and cross-user edits are blocked even if frontend code is wrong.
- Business rules like "cannot join a cancelled or past meetup" and "host cannot peck own meetup" live in SQL and must be kept in sync with UI validation.
- RLS must be verified before deployment (two test accounts, direct API attempts).
- ~~Follow-up: the "Update own meetups" policy lets a host change any column, not only `status`.~~ Resolved by `002_security_hardening.sql`: column-level grants allow hosts to update only `status`, and only to `'cancelled'`; clients can no longer set `id`/`status`/`created_at` on insert.
