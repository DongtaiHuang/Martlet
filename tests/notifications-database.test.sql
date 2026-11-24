-- Run only on a disposable database with migrations 001-011 applied.
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

-- Fixture: a study meetup with a real course code, starting in 90 minutes.
do $$
declare
  fixture_code text;
begin
  select c.code into strict fixture_code from public.courses c limit 1;
  insert into public.meetups (id, host_id, title, category, course_code, location_name, latitude, longitude, starts_at)
  values ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001',
    'Study session', 'study', fixture_code,
    (select name from public.campus_locations where id = 'redpath-library'),
    (select latitude from public.campus_locations where id = 'redpath-library'),
    (select longitude from public.campus_locations where id = 'redpath-library'),
    now() + interval '90 minutes');
end $$;

set local role authenticated;

-- Clients never write notification rows directly.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.expect_error($q$insert into public.notifications (user_id, kind, title) values ('00000000-0000-4000-8000-000000000002', 'meetup_new', 'Nope')$q$, '42501');

-- Only the host can fan out creation notices.
select pg_temp.expect_error($q$select public.notify_meetup_created('00000000-0000-4000-8000-000000000011')$q$, '42501');

-- Course-matched recipient: user2 takes the meetup's course.
insert into public.user_courses (user_id, course_code)
select '00000000-0000-4000-8000-000000000002', course_code from public.meetups where id = '00000000-0000-4000-8000-000000000011';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.notify_meetup_created('00000000-0000-4000-8000-000000000011');
-- Idempotent: a second fan-out adds nothing.
select public.notify_meetup_created('00000000-0000-4000-8000-000000000011');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$
declare mine jsonb;
begin
  mine := public.list_my_notifications(10);
  if jsonb_array_length(mine) <> 1 or mine->0->>'kind' <> 'meetup_new' then
    raise exception 'Expected exactly one meetup_new notification, got %', mine;
  end if;
end $$;

-- Reminders: user2 pecks the meetup; two materializations create one reminder.
insert into public.meetup_pecks (meetup_id, user_id)
values ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002');
select public.materialize_meetup_reminders();
select public.materialize_meetup_reminders();
do $$
declare mine jsonb;
begin
  mine := public.list_my_notifications(10);
  if jsonb_array_length(mine) <> 2
      or not exists (select 1 from jsonb_array_elements(mine) e where e->>'kind' = 'meetup_reminder') then
    raise exception 'Expected one meetup_reminder after two materializations, got %', mine;
  end if;
end $$;

-- Unread count and mark-all-read.
do $$ begin
  if public.count_my_unread_notifications() <> 2 then raise exception 'Expected 2 unread'; end if;
end $$;
select public.mark_my_notifications_read();
do $$ begin
  if public.count_my_unread_notifications() <> 0 then raise exception 'Expected 0 unread after marking read'; end if;
end $$;

-- Trend likes notify the owner once, never on self-like or re-like.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.create_trend_entry('Notify test brew', 'coffee', '', '', null);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select public.set_trend_like((select (e->>'id')::uuid from jsonb_array_elements(public.get_trending_entries('coffee', 5)) e where e->>'title' = 'Notify test brew'), true);
select public.set_trend_like((select (e->>'id')::uuid from jsonb_array_elements(public.get_trending_entries('coffee', 5)) e where e->>'title' = 'Notify test brew'), true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
declare mine jsonb;
begin
  mine := public.list_my_notifications(10);
  if (select count(*) from jsonb_array_elements(mine) e where e->>'kind' = 'trend_like') <> 1 then
    raise exception 'Expected exactly one trend_like after a re-like, got %', mine;
  end if;
end $$;
