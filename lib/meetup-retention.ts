// How long ended meetups are kept before the hourly cleanup deletes them (ADR 0038).
// Mirrors public.cleanup_ended_meetups() in supabase/migrations/024_meetup_cleanup.sql.
export const PAST_MEETUP_RETENTION_DAYS = 30;
export const CANCELLED_MEETUP_RETENTION_DAYS = 7;
