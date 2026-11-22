-- Run after 014 on a disposable migrated database. Fixtures roll back.
begin;

insert into auth.users (id) values
  ('92000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);

insert into public.meetups (host_id, title, category, location_name, latitude, longitude, starts_at)
select auth.uid(), 'Legacy single category', 'sports', c.name, c.latitude, c.longitude, now() + interval '2 hours'
from public.campus_locations c where c.id = 'leacock-building';

insert into public.meetups (host_id, title, category, categories, course_code, location_type, location_name, latitude, longitude, starts_at)
values (auth.uid(), 'Multi-category test', 'coffee', array['coffee', 'study'], 'COMP 302',
  'custom', 'Cafe Olimpico', null, null, now() + interval '2 hours');

do $$
declare
  invalid text[];
begin
  if not exists (select 1 from public.meetups where title = 'Legacy single category' and categories = array['sports']) then
    raise exception 'Legacy insert lost its category';
  end if;
  for invalid in select value from (values
    (array[]::text[]), (array['coffee','food','sports','study']), (array['coffee','coffee']),
    (array['coffee','other']), (array['coffee','social']), (array['coffee',null]),
    (array['food']), (array[['coffee','study']]), ('[0:1]={coffee,study}'::text[])
  ) as cases(value)
  loop
    begin
      insert into public.meetups (host_id, title, category, categories, location_type, location_name, latitude, longitude, starts_at)
      values (auth.uid(), 'Invalid test meetup', 'coffee', invalid, 'custom', 'Cafe Olimpico', null, null, now() + interval '2 hours');
      raise exception 'Invalid array accepted: %', invalid;
    exception when check_violation then null;
    end;
  end loop;
  if has_column_privilege('public.meetups', 'category', 'UPDATE')
    or has_column_privilege('public.meetups', 'categories', 'UPDATE') then
    raise exception 'Table grants allow bypassing the edit RPC';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
insert into public.meetup_pecks (meetup_id, user_id)
select id, auth.uid() from public.meetups where title = 'Multi-category test';
insert into public.meetup_flaps (meetup_id, user_id)
select id, auth.uid() from public.meetups where title = 'Multi-category test';

do $$
begin
  perform public.update_my_meetup(id, '{"categories":["food","study"]}')
  from public.meetups where title = 'Multi-category test';
  raise exception 'Non-host could edit meetup';
exception when no_data_found then null;
end;
$$;

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
do $$
declare
  original public.meetups%rowtype;
  updated public.meetups%rowtype;
  payload jsonb;
  invalid jsonb;
begin
  select * into strict original from public.meetups where title = 'Multi-category test';
  payload := to_jsonb(original) || '{"categories":["food","coffee","study"],"host_id":"92000000-0000-4000-8000-000000000002","status":"cancelled"}';
  if public.update_my_meetup(original.id, payload) <> original.id then
    raise exception 'Edit changed meetup identity';
  end if;
  select * into strict updated from public.meetups where id = original.id;
  if updated.category is distinct from 'food' or updated.categories is distinct from array['food','coffee','study']
    or updated.host_id is distinct from original.host_id or updated.status is distinct from original.status
    or updated.course_code is distinct from 'COMP 302' or updated.latitude is not null or updated.longitude is not null
    or (select count(*) from public.meetup_pecks where meetup_id = original.id) <> 1
    or (select count(*) from public.meetup_flaps where meetup_id = original.id) <> 1 then
    raise exception 'Edit did not preserve expected meetup state';
  end if;

  for invalid in select value from (values
    ('null'::jsonb), ('"coffee"'), ('["other","study"]'), ('["food","food"]'),
    ('[]'), ('["food","coffee","study","gaming"]'), ('["food"]')
  ) as cases(value)
  loop
    begin
      perform public.update_my_meetup(original.id, payload || jsonb_build_object('categories', invalid));
      raise exception 'Invalid RPC array or incompatible course accepted: %', invalid;
    exception when check_violation then null;
    end;
  end loop;

  begin
    perform public.update_my_meetup(original.id, payload || '{"latitude":45.5,"longitude":-73.5}');
    raise exception 'Custom meetup accepted fabricated coordinates';
  exception when check_violation then null;
  end;

  perform public.update_my_meetup(original.id, to_jsonb(updated) - 'categories');
  if (select categories from public.meetups where id = original.id) is distinct from updated.categories then
    raise exception 'Legacy edit discarded secondary categories';
  end if;

  perform public.update_my_meetup(original.id,
    payload || jsonb_build_object('categories', array['other'], 'course_code', null,
      'starts_at', now() + interval '3 hours'));
  if not exists (select 1 from public.meetups where id = original.id and category = 'other'
    and categories = array['other'] and course_code is null) then
    raise exception 'Study removal did not clear the course';
  end if;
end;
$$;

reset role;
do $$ begin
  if not exists (
    select 1 from public.notifications n join public.meetups m on m.id = n.meetup_id
    where m.title = 'Multi-category test' and n.kind = 'meetup_updated'
      and n.user_id = '92000000-0000-4000-8000-000000000002'
  ) then raise exception 'Time edit did not notify the attendee'; end if;
end $$;

rollback;
