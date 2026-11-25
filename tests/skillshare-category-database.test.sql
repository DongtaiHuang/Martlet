-- Skillshare category (migration 023). Run on a disposable migrated database. Fixtures roll back.
begin;

insert into auth.users (id) values ('93000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);

-- Legacy single-category insert and a multi-category one both accept "skills".
insert into public.meetups (host_id, title, category, location_name, latitude, longitude, starts_at)
select auth.uid(), 'Guitar basics', 'skills', c.name, c.latitude, c.longitude, now() + interval '2 hours'
from public.campus_locations c where c.id = 'leacock-building';
insert into public.meetups (host_id, title, category, categories, location_type, location_name, latitude, longitude, starts_at)
values (auth.uid(), 'LaTeX over coffee', 'skills', array['skills', 'coffee'], 'custom', 'Cafe Olimpico', null, null, now() + interval '2 hours');

do $$
declare invalid text[];
begin
  if (select count(*) from public.meetups where 'skills' = any(categories)) <> 2 then
    raise exception 'Skillshare meetups not saved';
  end if;
  if not exists (select 1 from public.meetups where title = 'Guitar basics' and categories = array['skills']) then
    raise exception 'Legacy insert lost its category';
  end if;
  -- Every earlier rule still holds.
  for invalid in select value from (values
    (array['skills', 'other']), (array['skills', 'skills']), (array['skills', 'dance']), (array['coffee', 'food', 'sports', 'skills'])
  ) as cases(value)
  loop
    begin
      insert into public.meetups (host_id, title, category, categories, location_type, location_name, latitude, longitude, starts_at)
      values (auth.uid(), 'Invalid test meetup', invalid[1], invalid, 'custom', 'Cafe Olimpico', null, null, now() + interval '2 hours');
      raise exception 'Invalid array accepted: %', invalid;
    exception when check_violation then null;
    end;
  end loop;
  begin
    insert into public.meetups (host_id, title, category, location_type, location_name, latitude, longitude, starts_at)
    values (auth.uid(), 'Unknown category', 'dance', 'custom', 'Cafe Olimpico', null, null, now() + interval '2 hours');
    raise exception 'Unknown single category accepted';
  exception when check_violation then null;
  end;
end $$;

rollback;
