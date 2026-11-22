-- Run on a disposable database after migration 010.
begin;
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

insert into public.meetups (host_id, title, category, course_code, location_type, location_name, latitude, longitude, starts_at)
values (auth.uid(), 'Custom study meetup', 'study', 'COMP 302', 'custom', 'Café Olimpico, Mile End', null, null, now() + interval '2 hours');

do $$
declare
  candidate record;
begin
  if not exists (select 1 from public.meetups where location_name = 'Café Olimpico, Mile End'
    and location_type = 'custom' and latitude is null and longitude is null and course_code = 'COMP 302')
  then raise exception 'Text-only meetup was not stored correctly'; end if;

  for candidate in select * from (values
    ('custom', 'Cafe', 45.5::double precision, -73.5::double precision, null::text),
    ('custom', '  ', null, null, null),
    ('custom', ' Cafe', null, null, null),
    ('custom', repeat('x', 161), null, null, null),
    ('custom', 'Cafe', null, null, 'atwater-market'),
    ('catalog', 'Cafe', null, null, null),
    ('campus', 'Cafe', null, null, null)
  ) as invalid(kind, name, lat, lng, venue)
  loop
    begin
      insert into public.meetups (host_id, title, category, location_type, location_name, latitude, longitude, public_venue_id, starts_at)
      values (auth.uid(), 'Invalid location', 'coffee', candidate.kind, candidate.name, candidate.lat, candidate.lng, candidate.venue, now() + interval '2 hours');
      raise exception 'Invalid location accepted';
    exception when check_violation then null;
    end;
  end loop;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$ begin
  if not exists (select 1 from public.meetups where title = 'Custom study meetup') then
    raise exception 'Other students cannot read custom meetups';
  end if;
  update public.meetups set status = 'cancelled' where title = 'Custom study meetup';
  if found then raise exception 'Non-host cancelled a custom meetup'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
update public.meetups set status = 'cancelled' where title = 'Custom study meetup';
rollback;
