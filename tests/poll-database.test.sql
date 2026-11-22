-- Run only on a disposable database with migrations 001–007 applied.
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
insert into public.meetups (id, host_id, title, category, location_name, latitude, longitude, starts_at)
select inputs.id::uuid, inputs.host::uuid, 'Poll fixture', 'coffee', c.name, c.latitude, c.longitude, now()+interval '2 hours'
from (values
  ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000001')
) inputs(id,host) cross join public.campus_locations c where c.id = 'redpath-library';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select pg_temp.expect_error($q$select public.create_meetup_poll('00000000-0000-4000-8000-000000000013', 'activity', 'What should we do?', clock_timestamp()+interval '1 hour', array['Coffee',' coffee '])$q$, '23505');
select pg_temp.expect_error($q$select public.create_meetup_poll('00000000-0000-4000-8000-000000000013', 'location', 'What should we do?', clock_timestamp()+interval '1 hour', array['redpath-library','invented'])$q$, '22023');
select pg_temp.expect_error($q$select public.create_meetup_poll('00000000-0000-4000-8000-000000000013', 'activity', 'What should we do?', clock_timestamp()+interval '3 hours', array['Coffee','Games'])$q$, '22023');
do $$ begin
  if public.get_meetup_poll_results('00000000-0000-4000-8000-000000000013') is not null then
    raise exception 'Failed option validation left a poll behind';
  end if;
end $$;
select public.create_meetup_poll('00000000-0000-4000-8000-000000000011', 'location', 'What should we do?', clock_timestamp()+interval '1 hour', array['redpath-library','mclennan-library']);
select pg_temp.expect_error($q$select public.create_meetup_poll('00000000-0000-4000-8000-000000000011', 'activity', 'What should we do?', clock_timestamp()+interval '1 hour', array['Coffee','Games'])$q$, '23505');
select public.create_meetup_poll('00000000-0000-4000-8000-000000000014', 'activity', 'What should we do?', clock_timestamp()+interval '1 hour', array['Coffee','Games']);
select public.create_meetup_poll('00000000-0000-4000-8000-000000000015', 'time', 'What should we do?', clock_timestamp()+interval '1.5 seconds', array[to_char((clock_timestamp()+interval '3 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), to_char((clock_timestamp()+interval '4 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')]);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select public.create_meetup_poll('00000000-0000-4000-8000-000000000012', 'activity', 'What should we do?', clock_timestamp()+interval '1 hour', array['Coffee','Games']);
select pg_temp.expect_error($q$select public.create_meetup_poll('00000000-0000-4000-8000-000000000013', 'activity', 'What should we do?', clock_timestamp()+interval '1 hour', array['Coffee','Games'])$q$, '42501');
select pg_temp.expect_error($q$select public.close_meetup_poll((public.get_meetup_poll_results('00000000-0000-4000-8000-000000000011')->>'id')::uuid)$q$, '42501');
select pg_temp.expect_error($q$select * from public.meetup_poll_votes$q$, '42501');
select pg_temp.expect_error($q$insert into public.meetup_poll_votes default values$q$, '42501');

do $$
declare
  result jsonb := public.get_meetup_poll_results('00000000-0000-4000-8000-000000000011');
  id uuid := (result->>'id')::uuid;
  first_option uuid := (result#>>'{options,0,id}')::uuid;
  second_option uuid := (result#>>'{options,1,id}')::uuid;
  unrelated uuid := (public.get_meetup_poll_results('00000000-0000-4000-8000-000000000012')#>>'{options,0,id}')::uuid;
begin
  perform pg_temp.expect_error(format('select public.cast_meetup_poll_vote(%L,%L)', id, unrelated), '22023');
  perform public.cast_meetup_poll_vote(id, first_option);
  perform public.cast_meetup_poll_vote(id, first_option);
  perform public.cast_meetup_poll_vote(id, second_option);
  result := public.get_meetup_poll_results('00000000-0000-4000-8000-000000000011');
  if result->>'selectedOptionId' is distinct from second_option::text
    or result#>>'{options,0,votes}' is distinct from '0'
    or result#>>'{options,1,votes}' is distinct from '1'
    or result#>>'{options,1,label}' is distinct from 'McLennan Library' then
    raise exception 'Vote replacement, counts, or canonical location label incorrect';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
declare
  result jsonb := public.get_meetup_poll_results('00000000-0000-4000-8000-000000000011');
  poll uuid := (result->>'id')::uuid;
  option_id uuid := (result#>>'{options,0,id}')::uuid;
begin
  if result->>'selectedOptionId' is not null then raise exception 'Other student selection exposed'; end if;
  perform public.cast_meetup_poll_vote(poll, option_id);
  perform public.close_meetup_poll(poll);
  result := public.get_meetup_poll_results('00000000-0000-4000-8000-000000000011');
  if (result->>'isOpen')::boolean or result#>>'{options,0,votes}' is distinct from '1' then
    raise exception 'Host vote or closure incorrect';
  end if;
  perform pg_temp.expect_error(format('select public.cast_meetup_poll_vote(%L,%L)', poll, option_id), '55000');
end;
$$;

update public.meetups set status = 'cancelled' where id = '00000000-0000-4000-8000-000000000014';
select pg_temp.expect_error($q$select public.cast_meetup_poll_vote((public.get_meetup_poll_results('00000000-0000-4000-8000-000000000014')->>'id')::uuid, (public.get_meetup_poll_results('00000000-0000-4000-8000-000000000014')#>>'{options,0,id}')::uuid)$q$, '55000');
select pg_sleep(1.6);
select pg_temp.expect_error($q$select public.cast_meetup_poll_vote((public.get_meetup_poll_results('00000000-0000-4000-8000-000000000015')->>'id')::uuid, (public.get_meetup_poll_results('00000000-0000-4000-8000-000000000015')#>>'{options,0,id}')::uuid)$q$, '55000');
select pg_temp.expect_error($q$select public.cast_meetup_poll_vote('00000000-0000-4000-8000-999999999999', null)$q$, 'P0002');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select public.create_meetup_poll('00000000-0000-4000-8000-000000000013', 'activity', 'What should we do?', clock_timestamp()+interval '1 hour', array['Coffee','Games'])$q$, '42501');
select pg_temp.expect_error($q$select public.cast_meetup_poll_vote(null,null)$q$, '42501');
select pg_temp.expect_error($q$select public.get_meetup_poll_results('00000000-0000-4000-8000-000000000011')$q$, '42501');
rollback;
