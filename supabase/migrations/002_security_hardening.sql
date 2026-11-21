-- McGill Martlet: RLS / privilege hardening on top of 001_mvp.sql.
-- Run once in the Supabase SQL Editor after 001_mvp.sql. Safe to re-run.
--
-- Audit findings fixed here:
--  1. "Update own meetups" let a host rewrite ANY column (title, starts_at into the past,
--     arbitrary coordinates) and re-open a cancelled meetup. Now hosts may only set
--     status = 'cancelled' (column-level UPDATE grant + WITH CHECK).
--  2. Inserts could set server-owned columns (id, created_at, status). Column-level INSERT
--     grants now limit clients to user-supplied fields; status still defaults to 'open'.
--  3. Locations were only range-checked, so the direct API accepted any coordinates
--     (ADR 0004). A campus_locations table + composite foreign key now enforces the
--     approved list for every writer. Keep it in sync with lib/locations.ts.
--  4. Profiles: users could update created_at. Only display_name is updatable now.
--  5. Signup display names: the trigger now uses the display_name from sign-up metadata
--     (falls back to the default when missing or out of the 2..30 range).
--
-- Already correct in 001 and left unchanged: host_id / user_id must equal auth.uid()
-- (no impersonation); pecks/flaps only on open, future meetups; hosts cannot peck their
-- own meetup; one peck/flap per user (primary keys); no DELETE policy on meetups;
-- all reads require an authenticated user.

-- 1. Hosts may only cancel (idempotently), never edit or re-open.
revoke update on public.meetups from anon, authenticated;
grant update (status) on public.meetups to authenticated;

drop policy if exists "Update own meetups" on public.meetups;
drop policy if exists "Hosts cancel own meetups" on public.meetups;
create policy "Hosts cancel own meetups" on public.meetups for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()) and status = 'cancelled');

-- 2. Clients only supply user-owned columns.
revoke insert on public.meetups from anon, authenticated;
grant insert (host_id, title, description, category, location_name, latitude, longitude, starts_at)
  on public.meetups to authenticated;

revoke insert on public.meetup_pecks from anon, authenticated;
grant insert (meetup_id, user_id) on public.meetup_pecks to authenticated;

revoke insert on public.meetup_flaps from anon, authenticated;
grant insert (meetup_id, user_id) on public.meetup_flaps to authenticated;

-- 3. Approved campus locations (mirror of lib/locations.ts).
create table if not exists public.campus_locations (
  id text primary key,
  name text not null unique,
  latitude double precision not null,
  longitude double precision not null,
  unique (name, latitude, longitude)
);
alter table public.campus_locations enable row level security;
revoke insert, update, delete, truncate on public.campus_locations from anon, authenticated;
drop policy if exists "Read campus locations" on public.campus_locations;
create policy "Read campus locations" on public.campus_locations for select
  to anon, authenticated using (true);

insert into public.campus_locations (id, name, latitude, longitude) values
  ('roddick-gates',   'Roddick Gates',   45.50392014, -73.57495366),
  ('redpath-library', 'Redpath Library', 45.50383233, -73.57742633),
  ('redpath-museum',  'Redpath Museum',  45.50446675, -73.57738453),
  ('arts-building',   'Arts Building',   45.505,      -73.5775)
on conflict (id) do update
  set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude;

alter table public.meetups drop constraint if exists meetups_campus_location_fkey;
alter table public.meetups add constraint meetups_campus_location_fkey
  foreign key (location_name, latitude, longitude)
  references public.campus_locations (name, latitude, longitude)
  on update cascade;

-- 4. Profiles: only the display name is editable.
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 5. Use the display name chosen at sign-up when it is valid.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  requested text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    case when char_length(requested) between 2 and 30 then requested else 'Martlet Student' end
  );
  return new;
end;
$$;
