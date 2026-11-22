-- Run on a disposable database with migrations 001–008 applied.
begin;

create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected SQLSTATE %', expected;
exception when others then
  if sqlstate <> expected then raise; end if;
end;
$$;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

insert into public.meetups (host_id, title, category, location_name, latitude, longitude, starts_at)
select auth.uid(), 'Campus test meetup', 'study', name, latitude, longitude, now() + interval '2 hours'
from public.campus_locations where id = 'trottier-building';

insert into public.meetups (host_id, title, category, location_name, latitude, longitude, public_venue_id, starts_at)
select auth.uid(), 'Public venue test meetup', 'food', name, latitude, longitude, id, now() + interval '2 hours'
from public.public_meetup_venues where id = 'jean-talon-market';

do $$ begin
  if not exists (
    select 1 from public.meetups where title = 'Campus test meetup'
      and public_venue_id is null and campus_location_name = 'Trottier Building'
  ) or not exists (
    select 1 from public.meetups where title = 'Public venue test meetup'
      and location_name = 'Jean-Talon Market' and latitude = 45.53597 and longitude = -73.61522
      and public_venue_id = 'jean-talon-market' and campus_location_name is null
  ) then
    raise exception 'Expected both campus and public meetups to persist their canonical coordinates';
  end if;
end $$;

select pg_temp.expect_error($q$
  insert into public.meetups (host_id, title, category, location_name, latitude, longitude, starts_at)
  values (auth.uid(), 'Private meetup', 'food', 'Unapproved location', 45.5, -73.58, now() + interval '2 hours')
$q$, '23503');

select pg_temp.expect_error($q$
  insert into public.meetups (host_id, title, category, location_name, latitude, longitude, public_venue_id, starts_at)
  values (auth.uid(), 'Wrong coordinates', 'food', 'Jean-Talon Market', 45.5, -73.58, 'jean-talon-market', now() + interval '2 hours')
$q$, '23503');

select pg_temp.expect_error($q$
  insert into public.meetups (host_id, title, category, location_name, latitude, longitude, public_venue_id, starts_at)
  values (auth.uid(), 'Wrong venue ID', 'food', 'Jean-Talon Market', 45.53597, -73.61522, 'invented-venue', now() + interval '2 hours')
$q$, '23503');

select pg_temp.expect_error($q$
  insert into public.meetups (host_id, title, category, location_name, latitude, longitude, public_venue_id, starts_at)
  values ('00000000-0000-4000-8000-000000000002', 'Wrong host', 'food', 'Jean-Talon Market', 45.53597, -73.61522, 'jean-talon-market', now() + interval '2 hours')
$q$, '42501');

select pg_temp.expect_error($q$
  insert into public.meetups (host_id, title, category, location_name, latitude, longitude, public_venue_id, starts_at)
  values (auth.uid(), 'Past venue meetup', 'food', 'Jean-Talon Market', 45.53597, -73.61522, 'jean-talon-market', now() - interval '2 hours')
$q$, '42501');

select pg_temp.expect_error($q$
  insert into public.public_meetup_venues (id, name, address, latitude, longitude)
  values ('invented', 'Private address', 'Private address', 45.5, -73.58)
$q$, '42501');

select pg_temp.expect_error($q$
  update public.meetups set public_venue_id = null where title = 'Public venue test meetup'
$q$, '42501');

update public.meetups set status = 'cancelled' where title = 'Public venue test meetup';
do $$ begin
  if not exists (select 1 from public.meetups where title = 'Public venue test meetup' and status = 'cancelled') then
    raise exception 'Host could not cancel their public venue meetup';
  end if;
end $$;

rollback;
