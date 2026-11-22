-- Issue #92. Apply after 013_meetup_editing.sql and before deploying the app.
begin;

alter table public.meetups add column categories text[];
update public.meetups set categories = array[category];

alter table public.meetups
  alter column categories set not null,
  add constraint meetups_categories_check check (
    cardinality(categories) between 1 and 3
    and array_ndims(categories) = 1
    and array_lower(categories, 1) = 1
    and case when array_ndims(categories) = 1 then array_position(categories, null) is null else false end
    and categories <@ array['coffee', 'study', 'food', 'sports', 'gaming', 'other']::text[]
    and (cardinality(categories) = 1 or not ('other' = any(categories)))
    and (cardinality(categories) < 2 or categories[1] <> categories[2])
    and (cardinality(categories) < 3 or (categories[1] <> categories[3] and categories[2] <> categories[3]))
    and category = categories[1]
  ),
  drop constraint meetups_course_only_for_study,
  add constraint meetups_course_only_for_study check (course_code is null or 'study' = any(categories));

-- Legacy clients can still insert only category. The check above also covers privileged writes.
create function public.fill_legacy_meetup_categories() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.categories is null then
    new.categories := array[new.category];
  end if;
  return new;
end;
$$;

create trigger fill_legacy_meetup_categories
before insert on public.meetups for each row
execute function public.fill_legacy_meetup_categories();

grant insert (categories) on public.meetups to authenticated;


create or replace function public.update_my_meetup(p_meetup_id uuid, p_meetup jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  old public.meetups%rowtype;
  new_starts timestamptz;
  new_categories text[];
  changed_when_or_where boolean;
begin
  if viewer is null then raise exception 'Sign in to edit meetups.' using errcode = '42501'; end if;

  select * into old from public.meetups where id = p_meetup_id for update;
  if not found or old.host_id <> viewer then
    raise exception 'Meetup not found, or you are not its host.' using errcode = 'P0002';
  end if;
  if old.status <> 'open' then
    raise exception 'Cancelled meetups can''t be edited.' using errcode = '55000';
  end if;
  if old.starts_at <= clock_timestamp() then
    raise exception 'This meetup has already started.' using errcode = '55000';
  end if;

  new_starts := (p_meetup ->> 'starts_at')::timestamptz;
  if new_starts is null or not isfinite(new_starts) or new_starts <= clock_timestamp() then
    raise exception 'Start time must be in the future.' using errcode = '23514';
  end if;

  if p_meetup ? 'categories' then
    if jsonb_typeof(p_meetup -> 'categories') is distinct from 'array' then
      raise exception 'Choose one to three valid categories.' using errcode = '23514';
    end if;
    new_categories := array(
      select value from jsonb_array_elements_text(p_meetup -> 'categories')
      with ordinality as item(value, position) order by position
    );
  elsif p_meetup ->> 'category' = old.category then
    -- An older editor saving the same primary category keeps any secondary selections.
    new_categories := old.categories;
  else
    new_categories := array[p_meetup ->> 'category'];
  end if;
  if new_categories[1] is null then
    raise exception 'Choose at least one valid category.' using errcode = '23514';
  end if;

  update public.meetups set
    title = p_meetup ->> 'title',
    description = coalesce(p_meetup ->> 'description', ''),
    category = new_categories[1],
    categories = new_categories,
    course_code = nullif(p_meetup ->> 'course_code', ''),
    starts_at = new_starts,
    location_type = coalesce(p_meetup ->> 'location_type', 'catalog'),
    location_name = p_meetup ->> 'location_name',
    latitude = (p_meetup ->> 'latitude')::double precision,
    longitude = (p_meetup ->> 'longitude')::double precision,
    public_venue_id = nullif(p_meetup ->> 'public_venue_id', '')
  where id = p_meetup_id;

  changed_when_or_where := old.starts_at is distinct from new_starts
    or old.location_name is distinct from (p_meetup ->> 'location_name');

  if changed_when_or_where then
    -- Reminders re-materialize for the new time on the next page load (ADR 0021); one fresh
    -- "updated" notice per attendee replaces any earlier one for this meetup.
    delete from public.notifications
      where meetup_id = p_meetup_id and kind in ('meetup_updated', 'meetup_reminder');
    insert into public.notifications (user_id, kind, meetup_id, title, body, href)
    select pk.user_id, 'meetup_updated', m.id,
      'Updated: ' || m.title,
      'Now at ' || m.location_name || ' · starts ' || to_char(m.starts_at at time zone 'America/Toronto', 'Mon DD HH24:MI'),
      '/meetups/' || m.id::text
    from public.meetup_pecks pk
    join public.meetups m on m.id = pk.meetup_id
    where pk.meetup_id = p_meetup_id and pk.user_id <> viewer
    on conflict do nothing;
  end if;

  return p_meetup_id;
end;
$$;

revoke all on function public.update_my_meetup(uuid, jsonb) from public, anon;
grant execute on function public.update_my_meetup(uuid, jsonb) to authenticated;

commit;
