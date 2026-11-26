-- Auto-cleanup of ended meetups (issue #153, ADR 0038).
-- Meetups have no end time, so retention counts from the start time:
--   open meetups are deleted 30 days after they start,
--   cancelled meetups 7 days after their planned start.
-- Pecks, Flaps, polls and notifications go with them (all `on delete cascade`).
-- Feeds and the map already hide meetups once they start; this only removes old rows.
-- Keep lib/meetup-retention.ts in sync. Safe to re-run.
begin;

create or replace function public.cleanup_ended_meetups(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  delete from public.meetups m
  where (m.status = 'open' and m.starts_at < p_now - interval '30 days')
     or (m.status = 'cancelled' and m.starts_at < p_now - interval '7 days');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Only the database owner (and pg_cron, which runs as the owner) may call it.
revoke all on function public.cleanup_ended_meetups(timestamptz) from public, anon, authenticated;

commit;

-- Run it every hour with pg_cron. If pg_cron can't be enabled here, the function still
-- exists: enable pg_cron (Dashboard → Database → Extensions) and re-run this file.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension pg_cron with schema pg_catalog;
    exception when others then
      raise warning 'pg_cron is not available (%). Enable it in Database → Extensions and re-run 024_meetup_cleanup.sql.', sqlerrm;
      return;
    end;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-ended-meetups';
  perform cron.schedule('cleanup-ended-meetups', '17 * * * *', 'select public.cleanup_ended_meetups()');
end $$;
