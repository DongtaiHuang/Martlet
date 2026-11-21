-- Explicit table privileges for the Data API roles. Safe to re-run.
--
-- Newer Supabase projects no longer auto-grant privileges on new public tables to
-- anon/authenticated, so 001/002 (which relied on that default) left the app with
-- "permission denied" (42501). RLS policies still decide which ROWS each user can
-- touch; these grants only allow the operations those policies were written for.
-- Column-level INSERT/UPDATE grants from 002 are unchanged.

grant usage on schema public to anon, authenticated;

-- Reads: all app data requires sign-in (RLS policies are "to authenticated").
grant select on public.profiles, public.meetups, public.meetup_pecks, public.meetup_flaps
  to authenticated;
grant select on public.campus_locations to anon, authenticated;

-- Unpeck / unflap: RLS limits deletes to the user's own rows.
grant delete on public.meetup_pecks, public.meetup_flaps to authenticated;

-- Re-assert 002's column-level write grants in case 002 ran before the tables were exposed.
grant insert (host_id, title, description, category, location_name, latitude, longitude, starts_at)
  on public.meetups to authenticated;
grant update (status) on public.meetups to authenticated;
grant insert (meetup_id, user_id) on public.meetup_pecks to authenticated;
grant insert (meetup_id, user_id) on public.meetup_flaps to authenticated;
grant update (display_name) on public.profiles to authenticated;
