-- Auto-cleanup of ended meetups (migration 024). Run on a disposable migrated database. Fixtures roll back.
begin;

insert into auth.users (id) values
  ('94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000002');

-- Fixtures are inserted as the owner so past start times are allowed.
insert into public.meetups (id, host_id, title, category, location_type, location_name, latitude, longitude, starts_at, status) values
  ('94100000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', 'Upcoming coffee',   'coffee', 'custom', 'Cafe Olimpico', null, null, now() + interval '2 hours', 'open'),
  ('94100000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000001', 'Recent study',      'study',  'custom', 'Cafe Olimpico', null, null, now() - interval '29 days', 'open'),
  ('94100000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000001', 'Old study',         'study',  'custom', 'Cafe Olimpico', null, null, now() - interval '31 days', 'open'),
  ('94100000-0000-4000-8000-000000000004', '94000000-0000-4000-8000-000000000001', 'Recent cancelled',  'food',   'custom', 'Cafe Olimpico', null, null, now() - interval '6 days',  'cancelled'),
  ('94100000-0000-4000-8000-000000000005', '94000000-0000-4000-8000-000000000001', 'Old cancelled',     'food',   'custom', 'Cafe Olimpico', null, null, now() - interval '8 days',  'cancelled'),
  ('94100000-0000-4000-8000-000000000006', '94000000-0000-4000-8000-000000000001', 'Future cancelled',  'food',   'custom', 'Cafe Olimpico', null, null, now() + interval '3 days',  'cancelled');
insert into public.meetup_pecks (meetup_id, user_id) values
  ('94100000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000002'),
  ('94100000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000002');
insert into public.meetup_flaps (meetup_id, user_id) values
  ('94100000-0000-4000-8000-000000000003', '94000000-0000-4000-8000-000000000002');

-- Students can't run the cleanup themselves.
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
do $$
begin
  perform public.cleanup_ended_meetups();
  raise exception 'Students could run the cleanup';
exception when insufficient_privilege then null;
end $$;
reset role;

do $$
declare v_deleted integer;
begin
  v_deleted := public.cleanup_ended_meetups();
  if v_deleted <> 2 then raise exception 'Expected 2 deleted meetups, got %', v_deleted; end if;

  if exists (select 1 from public.meetups where id in ('94100000-0000-4000-8000-000000000003', '94100000-0000-4000-8000-000000000005')) then
    raise exception 'Expired meetups were kept';
  end if;
  if (select count(*) from public.meetups where id::text like '94100000-%') <> 4 then
    raise exception 'Upcoming or recent meetups were deleted';
  end if;
  -- Dependent rows go with the meetup; the recent meetup keeps its Peck.
  if exists (select 1 from public.meetup_pecks where meetup_id = '94100000-0000-4000-8000-000000000003')
     or exists (select 1 from public.meetup_flaps where meetup_id = '94100000-0000-4000-8000-000000000003') then
    raise exception 'Pecks or Flaps of a deleted meetup were kept';
  end if;
  if not exists (select 1 from public.meetup_pecks where meetup_id = '94100000-0000-4000-8000-000000000002') then
    raise exception 'Peck of a recent meetup was deleted';
  end if;

  -- Running it again is a no-op.
  if public.cleanup_ended_meetups() <> 0 then raise exception 'Second run deleted more meetups'; end if;
end $$;

rollback;
