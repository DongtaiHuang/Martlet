-- Hosts can edit their own upcoming meetups (issue #73, ADR 0023). Run after 012. Safe to re-run.
--
-- Why a function instead of wider UPDATE grants: Postgres checks the old row against any
-- policy's USING and the new row against any policy's WITH CHECK independently, so adding an
-- "edit" policy next to 002's cancel-only policy would let a host re-open a cancelled meetup.
-- This SECURITY DEFINER function does every check in one place. The table's own constraints
-- (title/description length, category, approved campus location / public venue foreign keys,
-- custom-location shape, course_code exists and only for study) still apply to the UPDATE.
begin;

-- New notification kind for people who joined a meetup whose time or place changed.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('meetup_new', 'meetup_reminder', 'trend_like', 'meetup_updated'));
alter table public.notifications drop constraint if exists notifications_meetup_updated_check;
alter table public.notifications add constraint notifications_meetup_updated_check
  check (kind <> 'meetup_updated' or meetup_id is not null);

create or replace function public.update_my_meetup(p_meetup_id uuid, p_meetup jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  old public.meetups%rowtype;
  new_starts timestamptz;
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
  if old.starts_at <= now() then
    raise exception 'This meetup has already started.' using errcode = '55000';
  end if;

  new_starts := (p_meetup ->> 'starts_at')::timestamptz;
  if new_starts is null or new_starts <= now() then
    raise exception 'Start time must be in the future.' using errcode = '23514';
  end if;

  update public.meetups set
    title = p_meetup ->> 'title',
    description = coalesce(p_meetup ->> 'description', ''),
    category = p_meetup ->> 'category',
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
